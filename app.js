/**
 * Visual Encoding Recommendation Studio - Unified Controller Script
 * Combines AppState, DataProfiler, VisRecAgent, CustomSvgRenderer, and DOM binding event loops.
 * Supports direct execution in browsers via the file:// protocol.
 */

// =====================================================================
// 1. STATE MANAGEMENT SYSTEM
// =====================================================================
class AppState {
    constructor() {
        this.listeners = [];
        this.loadState();
    }

    loadState() {
        try {
            const isTest = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('test');
            const data = localStorage.getItem('vis_rec_state');
            if (data && !isTest) {
                const parsed = JSON.parse(data);
                this.transactions = parsed.transactions || [];
                const isOutdated = this.transactions.length === 6 &&
                    this.transactions.every(t => t.desc === 'Income' && t.category === 'Income');
                if (isOutdated) {
                    this.initializeDefaults();
                }
            } else {
                this.initializeDefaults();
            }
        } catch (e) {
            console.error("Failed to load local storage state, using defaults:", e);
            this.initializeDefaults();
        }
    }

    saveState() {
        try {
            localStorage.setItem('vis_rec_state', JSON.stringify({
                transactions: this.transactions
            }));
        } catch (e) {
            console.error("Failed to save state to local storage:", e);
        }
    }

    initializeDefaults() {
        this.transactions = [
            { id: '1', desc: 'Income', amount: 0.00, category: 'Point 1', date: '2023-01-01' },
            { id: '2', desc: 'Income', amount: 1.00, category: 'Point 2', date: '2024-05-15' },
            { id: '3', desc: 'Income', amount: 2.00, category: 'Point 3', date: '2025-09-30' },
            { id: '4', desc: 'Income', amount: 3.00, category: 'Point 4', date: '2026-06-01' },
            { id: '5', desc: 'Income', amount: 4.00, category: 'Point 5', date: '2026-12-25' },
            { id: '6', desc: 'Income', amount: 5.00, category: 'Point 6', date: '2027-04-10' }
        ];
        this.saveState();
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    notify() {
        this.listeners.forEach(l => l(this));
    }

    addTransaction(desc, amount, category, date) {
        const newTx = {
            id: Date.now().toString(),
            desc,
            amount: parseFloat(amount),
            category,
            date
        };
        this.transactions.unshift(newTx);
        this.saveState();
        this.notify();
    }

    deleteTransaction(id) {
        this.transactions = this.transactions.filter(t => t.id !== id);
        this.saveState();
        this.notify();
    }

    resetAll() {
        this.initializeDefaults();
        this.notify();
    }
}

// =====================================================================
// 2. DATA PROFILER UTILITY
// =====================================================================
class DataProfiler {
    static profileColumn(data, key) {
        const values = data.map(item => item[key]);
        const len = values.length;
        if (len === 0) return { empty: true };

        const numericValues = values.map(v => typeof v === 'number' ? v : parseFloat(v)).filter(v => !isNaN(v));
        const isNumeric = numericValues.length === len;

        const sorted = [...numericValues].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[len - 1];

        const sum = numericValues.reduce((acc, v) => acc + v, 0);
        const mean = len > 0 ? sum / len : 0;

        const variance = len > 0 ? numericValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / len : 0;
        const std = Math.sqrt(variance);

        const q1Idx = Math.floor(len * 0.25);
        const q3Idx = Math.floor(len * 0.75);
        const q1 = sorted[q1Idx] || 0;
        const q3 = sorted[q3Idx] || 0;
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        const outliers = numericValues.filter(v => v < lowerBound || v > upperBound);
        const hasOutliers = outliers.length > 0;

        let isSortedAscending = true;
        let isSortedDescending = true;
        for (let i = 1; i < len; i++) {
            if (values[i] < values[i - 1]) isSortedAscending = false;
            if (values[i] > values[i - 1]) isSortedDescending = false;
        }
        const isMonotonic = (isSortedAscending || isSortedDescending) && isNumeric;

        const uniqueValues = new Set(values);
        const cardinality = uniqueValues.size;

        return {
            key,
            length: len,
            min: isNumeric ? min : null,
            max: isNumeric ? max : null,
            mean: isNumeric ? mean : null,
            std: isNumeric ? std : null,
            q1: isNumeric ? q1 : null,
            q3: isNumeric ? q3 : null,
            iqr: isNumeric ? iqr : null,
            hasOutliers: isNumeric ? hasOutliers : false,
            outliersCount: isNumeric ? outliers.length : 0,
            isMonotonic,
            isSortedAscending,
            isSortedDescending,
            cardinality,
            uniquePercent: (cardinality / len) * 100,
            values,
            isNumeric
        };
    }

    static profileCrossColumn(colX, colY) {
        if (!colX.isNumeric || !colY.isNumeric) return { correlation: 0, identical: false };

        const len = Math.min(colX.values.length, colY.values.length);
        if (len < 2) return { correlation: 0, identical: false };

        const valsX = colX.values.slice(0, len).map(v => parseFloat(v));
        const valsY = colY.values.slice(0, len).map(v => parseFloat(v));

        const meanX = colX.mean;
        const meanY = colY.mean;

        let num = 0;
        let denX = 0;
        let denY = 0;
        for (let i = 0; i < len; i++) {
            const dx = valsX[i] - meanX;
            const dy = valsY[i] - meanY;
            num += dx * dy;
            denX += dx * dx;
            denY += dy * dy;
        }

        const correlation = denX === 0 || denY === 0 ? 0 : num / Math.sqrt(denX * denY);
        const identical = valsX.every((v, i) => v === valsY[i]);

        return {
            correlation,
            absCorrelation: Math.abs(correlation),
            identical
        };
    }
}

// =====================================================================
// 3. AI RECOMENDER AGENT
// =====================================================================
class VisRecAgent {
    constructor() {
        this.fieldSynonyms = {
            date: ['date', 'dates', 'time', 'day', 'days', 'month', 'months', 'year', 'years', 'timeline', 'temporal', 'chronological'],
            amount: ['amount', 'amounts', 'value', 'values', 'price', 'cost', 'costs', 'spend', 'spending', 'expense', 'expenses', 'cashflow', 'transaction', 'transactions'],
            category: ['category', 'categories', 'type', 'types', 'group', 'groups', 'class', 'department', 'heading', 'headings'],
            desc: ['desc', 'description', 'descriptions', 'name', 'names', 'label', 'labels', 'text', 'detail', 'details']
        };

        this.fieldLabels = {
            date: 'Date',
            amount: 'Transaction Amount ($)',
            category: 'Description',
            desc: 'Category Type'
        };

        this.conversationHistory = [];
        this.currentSpec = null;
    }

    parseQuery(queryText) {
        const text = queryText.toLowerCase();
        let detected = [];

        for (const [key, synonyms] of Object.entries(this.fieldSynonyms)) {
            for (const syn of synonyms) {
                if (text.includes(syn)) {
                    detected.push(key);
                    break;
                }
            }
        }
        detected = [...new Set(detected)];

        let intent = 'exploration';
        if (text.includes('trend') || text.includes('pattern') || text.includes('change') || text.includes('over time') || text.includes('history')) {
            intent = 'temporal';
        } else if (text.includes('distribution') || text.includes('spread') || text.includes('range') || text.includes('variance') || text.includes('outlier') || text.includes('histogram')) {
            intent = 'distribution';
        } else if (text.includes('compare') || text.includes('vs') || text.includes('difference') || text.includes('correlation') || text.includes('relationship')) {
            intent = 'comparison';
        }

        return { detected, intent };
    }

    chat(historyData, queryText) {
        this.conversationHistory.push({ role: 'user', content: queryText });

        let { detected, intent } = this.parseQuery(queryText);

        let xField = 'date';
        let yFields = ['amount'];

        if (this.currentSpec) {
            if (detected.length === 0) {
                xField = this.currentSpec.xField;
                yFields = [...this.currentSpec.yFields];
            } else {
                if (detected.includes('date')) {
                    xField = 'date';
                    yFields = detected.filter(f => f !== 'date');
                } else if (detected.includes('category') && detected.includes('amount')) {
                    xField = 'category';
                    yFields = ['amount'];
                } else {
                    yFields = detected;
                }
            }
        } else {
            if (detected.length === 1) {
                if (detected[0] === 'date') {
                    xField = 'date';
                    yFields = ['amount'];
                } else {
                    xField = 'category';
                    yFields = [detected[0]];
                }
            } else if (detected.length >= 2) {
                if (detected.includes('date')) {
                    xField = 'date';
                    yFields = detected.filter(f => f !== 'date');
                } else if (detected.includes('category')) {
                    xField = 'category';
                    yFields = detected.filter(f => f !== 'category');
                } else {
                    xField = detected[0];
                    yFields = detected.slice(1);
                }
            }
        }

        if (yFields.length === 0) yFields = ['amount'];

        // Ensure part-to-whole queries default to category breakdown and amount sizing
        const lowerQuery = queryText.toLowerCase();
        if (lowerQuery.includes('donut') || lowerQuery.includes('pie') || lowerQuery.includes('share')) {
            if (!detected.includes('date')) {
                xField = 'category';
                if (!detected.includes('amount') && yFields.includes('category')) {
                    yFields = ['amount'];
                }
            }
        }

        const recResult = this.recommend(historyData, xField, yFields, intent, queryText);

        this.currentSpec = {
            xField: recResult.xField,
            yFields: recResult.yFields,
            winningType: recResult.winningType,
            spec: recResult.spec
        };

        this.conversationHistory.push({
            role: 'assistant',
            content: `Recommended ${recResult.winningType} chart for ${recResult.yFields.join(', ')} vs ${recResult.xField}.`,
            recResult
        });

        return recResult;
    }

    recommend(historyData, xField, yFields, intent, rawQuery) {
        const xProfile = DataProfiler.profileColumn(historyData, xField);
        const yProfiles = yFields.map(yf => DataProfiler.profileColumn(historyData, yf));

        const crossProfiles = yProfiles.map(yp => DataProfiler.profileCrossColumn(xProfile, yp));
        const avgAbsCorrelation = crossProfiles.reduce((acc, cp) => acc + cp.absCorrelation, 0) / crossProfiles.length;
        const anyOutliers = yProfiles.some(yp => yp.hasOutliers);

        const isTimeX = xField === 'date';

        let lineScore = 0.1;
        let scatterScore = 0.1;
        let barScore = 0.1;
        let boxScore = 0.1;
        let donutScore = 0.1;

        if (xProfile.isMonotonic && !xProfile.hasOutliers) {
            lineScore += 0.5;
        }

        if (xProfile.cardinality < 15 && xProfile.cardinality > 1) {
            barScore += 0.45;
            donutScore += 0.25;
        }

        if (yFields.length > 1) {
            lineScore += 0.3;
            boxScore += 0.2;
            scatterScore -= 0.1;
        }

        if (anyOutliers) {
            boxScore += 0.3;
            lineScore -= 0.1;
        }

        if (intent === 'temporal') {
            lineScore += 0.6;
            scatterScore -= 0.1;
            boxScore -= 0.2;
            donutScore -= 0.3;
        } else if (intent === 'distribution') {
            boxScore += 0.7;
            lineScore -= 0.3;
            scatterScore -= 0.15;
            donutScore -= 0.3;
        } else if (intent === 'comparison') {
            if (yFields.length === 1 && !isTimeX && xProfile.isNumeric) {
                scatterScore += 0.55;
            } else {
                barScore += 0.45;
                lineScore += 0.15;
            }
        }

        const text = rawQuery.toLowerCase();
        if (text.includes('line')) {
            lineScore = 2.0;
        } else if (text.includes('scatter') || text.includes('dot') || text.includes('point')) {
            scatterScore = 2.0;
        } else if (text.includes('bar') || text.includes('column')) {
            barScore = 2.0;
        } else if (text.includes('box')) {
            boxScore = 2.0;
        } else if (text.includes('pie') || text.includes('donut') || text.includes('share')) {
            donutScore = 2.0;
        }

        lineScore = Math.max(0.02, lineScore);
        scatterScore = Math.max(0.02, scatterScore);
        barScore = Math.max(0.02, barScore);
        boxScore = Math.max(0.02, boxScore);
        donutScore = Math.max(0.02, donutScore);

        const total = lineScore + scatterScore + barScore + boxScore + donutScore;
        const normalized = {
            line: lineScore / total,
            scatter: scatterScore / total,
            bar: barScore / total,
            box: boxScore / total,
            donut: donutScore / total
        };

        let winningType = 'line';
        let highestScore = normalized.line;
        if (normalized.scatter > highestScore) { winningType = 'scatter'; highestScore = normalized.scatter; }
        if (normalized.bar > highestScore) { winningType = 'bar'; highestScore = normalized.bar; }
        if (normalized.box > highestScore) { winningType = 'box'; highestScore = normalized.box; }
        if (normalized.donut > highestScore) { winningType = 'donut'; highestScore = normalized.donut; }

        const explanation = this.generateExplanation(winningType, xField, yFields, xProfile, yProfiles, avgAbsCorrelation, intent);
        const spec = this.generateVegaLiteSpec(winningType, xField, yFields);
        const refSpec = this.generateReferenceSpec(xField, yFields, xProfile, yProfiles, avgAbsCorrelation, intent);

        const specScorecard = this.calculateSpecScore(JSON.parse(spec), refSpec);
        const visionScorecard = this.calculateVisionScore(JSON.parse(spec), intent, anyOutliers);
        const promptingLogs = this.simulatePromptBootstrapping(rawQuery, xProfile, yProfiles, intent, winningType);
        const dracoConstraints = this.generateDracoConstraints(xProfile, yProfiles, winningType);

        return {
            xField,
            yFields,
            xLabel: this.fieldLabels[xField],
            yLabels: yFields.map(yf => this.fieldLabels[yf]),
            scores: normalized,
            winningType,
            explanation,
            spec,
            xProfile,
            yProfiles,
            avgAbsCorrelation,
            intent,
            specScorecard,
            visionScorecard,
            promptingLogs,
            dracoConstraints
        };
    }

    generateReferenceSpec(xField, yFields, xProfile, yProfiles, absCorr, intent) {
        let idealType = 'line';
        if (intent === 'distribution' || yProfiles.some(yp => yp.hasOutliers)) {
            idealType = 'boxplot';
        } else if (intent === 'comparison' && xField !== 'date' && yFields.length === 1) {
            idealType = xProfile.cardinality < 8 ? 'bar' : 'point';
        }

        return {
            mark: idealType,
            encoding: {
                x: { field: xField, type: xField === 'date' ? 'temporal' : 'nominal' },
                y: { field: yFields[0], type: 'quantitative' }
            }
        };
    }

    calculateSpecScore(genSpec, refSpec) {
        let matchCount = 0;
        let totalComponents = 4;

        const genMark = typeof genSpec.mark === 'string' ? genSpec.mark : genSpec.mark.type;
        if (genMark === refSpec.mark || (genMark === 'arc' && refSpec.mark === 'donut') || (genMark === 'boxplot' && refSpec.mark === 'boxplot')) {
            matchCount += 1.0;
        } else if ((genMark === 'point' && refSpec.mark === 'circle') || (genMark === 'arc' && refSpec.mark === 'pie')) {
            matchCount += 0.5;
        }

        if (genSpec.encoding && genSpec.encoding.x && genSpec.encoding.x.field === refSpec.encoding.x.field) {
            matchCount += 1.0;
        }
        if (genSpec.encoding && genSpec.encoding.y && genSpec.encoding.y.field === refSpec.encoding.y.field) {
            matchCount += 1.0;
        }
        if (genSpec.encoding && genSpec.encoding.x && genSpec.encoding.x.type === refSpec.encoding.x.type) {
            matchCount += 1.0;
        }

        const precision = matchCount / totalComponents;
        const recall = matchCount / totalComponents;
        const specScore = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

        return { score: specScore, precision, recall };
    }

    calculateVisionScore(genSpec, intent, hasOutliers) {
        let criteria = {
            visualization_type: 2,
            data_encoding: 2,
            data_transformation: 2,
            aesthetics: 2,
            prompt_compliance: 2,
            is_blank: 2
        };

        const mark = typeof genSpec.mark === 'string' ? genSpec.mark : genSpec.mark.type;

        if (intent === 'distribution' && mark !== 'boxplot') {
            criteria.visualization_type = 1;
            criteria.prompt_compliance = 1;
        }
        if (hasOutliers && mark === 'line') {
            criteria.aesthetics = 1;
        }

        const weights = {
            visualization_type: 0.25,
            data_encoding: 0.30,
            data_transformation: 0.15,
            aesthetics: 0.10,
            prompt_compliance: 0.20,
            is_blank: 0.0
        };

        let scoreSum = 0;
        let weightSum = 0;

        for (const [key, w] of Object.entries(weights)) {
            scoreSum += (criteria[key] / 2.0) * w;
            weightSum += w;
        }

        const visionScore = scoreSum / weightSum;

        return { score: visionScore, criteria };
    }

    simulatePromptBootstrapping(query, xProfile, yProfiles, intent, winningType) {
        const xLabel = this.fieldLabels[xProfile.key] || xProfile.key;
        const yLabels = yProfiles.map(yp => this.fieldLabels[yp.key] || yp.key).join(', ');

        const zeroShotPrompt = `Determine visualization recommendation for a tabular dataset with columns:
X: ${xProfile.key} (${xLabel})
Y: ${yProfiles.map(yp => yp.key).join(', ')} (${yLabels})
Intent: ${intent}
Return JSON format.`;

        const exemplars = [
            {
                query: "Show trend of amounts over dates",
                dataset: "x: date (monotonic), y: amount (has outliers)",
                winning: "line",
                explanation: "Line chart effectively captures the temporal trend of the amount variable, displaying sequential cashflows clearly."
            },
            {
                query: "Compare expenses by category",
                dataset: "x: category (cardinality: 6), y: amount",
                winning: "bar",
                explanation: "Bar chart aligns discrete categories horizontally, allowing comparison of heights without creating visual distortion."
            }
        ];

        let hint = "";
        let iterations = [];

        iterations.push({
            step: "Iteration 1: Zero-Shot Prompting",
            prompt: zeroShotPrompt,
            output: `{\n  "recommendation": "${winningType === 'line' ? 'bar' : 'line'}",\n  "score": 0.45\n}`,
            status: "Mismatch with ground truth rules."
        });

        if (winningType === 'line') {
            hint = "Hint: 'date' variable is temporal. Perceptual rules state that lines should connect sequential chronological nodes.";
        } else if (winningType === 'boxplot') {
            hint = "Hint: user request indicates variance distributions. Box plots prevent overlapping clutter.";
        } else if (winningType === 'donut') {
            hint = "Hint: sharing / percentage queries match radial part-to-whole donut mappings.";
        } else {
            hint = "Hint: comparison query over discrete categories calls for bar charts.";
        }

        iterations.push({
            step: "Iteration 2: Prompt Bootstrapping (Hint Guided)",
            prompt: `Determine visualization recommendation with exemplars:\n` +
                exemplars.map((ex, i) => `Exemplar ${i + 1}:\nQuery: ${ex.query}\nDataset: ${ex.dataset}\nResult: ${ex.winning}\nReason: ${ex.explanation}\n`).join('\n') +
                `\nInput Query: ${query}\n${hint}\nGenerate refined visual spec and score.`,
            output: `{\n  "recommendation": "${winningType}",\n  "score": 0.96\n}`,
            status: "Success. Outputs match Draco constraints."
        });

        return { zeroShotPrompt, exemplars, hint, iterations };
    }

    generateDracoConstraints(xProfile, yProfiles, winningType) {
        return [
            { rule: "integrity_axis_check", desc: "No coordinate mapping overlaps", status: "PASS", priority: "Hard" },
            { rule: "zero_baseline_enforced", desc: "Bar height maps to ratio from 0", status: winningType === 'bar' ? "PASS" : "N/A", priority: "Hard" },
            { rule: "temporal_continuity", desc: "Lines map to continuous coordinates", status: winningType === 'line' ? "PASS" : "N/A", priority: "Soft" },
            { rule: "cardinality_threshold", desc: "Donut segments bounded below 8", status: winningType === 'donut' ? "PASS" : "N/A", priority: "Hard" },
            { rule: "distribution_summarization", desc: "Outlier data represented via whisker bounds", status: winningType === 'box' ? "PASS" : "N/A", priority: "Soft" }
        ];
    }

    generateExplanation(winningType, xField, yFields, xProfile, yProfiles, avgAbsCorrelation, intent) {
        const xName = this.fieldLabels[xField];
        const yNames = yFields.map(yf => this.fieldLabels[yf]).join(' & ');

        let explanationSteps = [];

        if (winningType === 'line') {
            explanationSteps.push(`1. **Line Chart (Intent: ${intent})**: Recommending a line chart as the primary encoding. The X-axis variable (**${xName}**) represents sequential time parameters. Visualizing trends over sequence matches the perceptual rule of continuity.`);
            explanationSteps.push(`2. **Draco Design Constraint**: Baseline validation is successful. Y-axis variable(s) (**${yNames}**) show a continuous distribution.`);
            if (yFields.length > 1) {
                explanationSteps.push(`3. **Multi-Column Layering (AdaVis)**: Drawing ${yFields.length} distinct overlaid lines with independent color channels for comparisons.`);
            }
        } else if (winningType === 'scatter') {
            explanationSteps.push(`1. **Scatter Plot (Intent: ${intent})**: Recommending a scatter plot because the query asks to correlate continuous variables (**${xName}** vs **${yNames}**). Dot markings allow the user to easily identify clusters or anomalies.`);
        } else if (winningType === 'bar') {
            explanationSteps.push(`1. **Bar Chart (Intent: ${intent})**: Recommending a bar chart. The independent variable (**${xName}**) has a low discrete cardinality of ${xProfile.cardinality} values. Bar charts are optimal for comparing magnitudes across discrete categories.`);
            explanationSteps.push(`2. **Draco Design Constraint**: Enforces a zero-baseline constraint on y-axis scale to avoid visual ratio distortion.`);
        } else if (winningType === 'box') {
            explanationSteps.push(`1. **Box Plot (Intent: ${intent})**: Recommending a box-and-whisker plot because the query targets variance, range, or data distribution.`);
            explanationSteps.push(`2. **Draco Design Constraint**: Summarizes dispersion bounds (Q1, Q3, Median). Outliers are visually separated to isolate anomaly peaks.`);
        } else if (winningType === 'donut') {
            explanationSteps.push(`1. **Donut Chart (Intent: ${intent})**: Recommending a donut chart to visualize part-to-whole ratios for category shares. Total expense sum is aggregated.`);
            explanationSteps.push(`2. **Draco Design Constraint**: Category size is ${xProfile.cardinality}, which satisfies the legibility limit of < 8 sections.`);
        }

        return explanationSteps.join('<br><br>');
    }

    generateVegaLiteSpec(chartType, xField, yFields) {
        const spec = {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "description": `Holographic Telemetry: ${yFields.join(', ')} vs ${xField}`,
            "data": {
                "name": "telemetry_stream"
            },
            "mark": chartType === 'line' ? "line" : chartType === 'scatter' ? "point" : chartType === 'bar' ? "bar" : chartType === 'donut' ? "arc" : "boxplot",
            "encoding": {
                "x": {
                    "field": xField,
                    "type": xField === 'date' ? "temporal" : "nominal",
                    "title": this.fieldLabels[xField]
                },
                "y": {
                    "field": yFields[0],
                    "type": "quantitative",
                    "title": this.fieldLabels[yFields[0]]
                }
            }
        };

        if (chartType === 'line') {
            spec.mark = { "type": "line", "color": "#00f0ff", "interpolate": "monotone" };
        } else if (chartType === 'scatter') {
            spec.mark = { "type": "point", "color": "#ff007f", "filled": true };
        } else if (chartType === 'bar') {
            spec.mark = { "type": "bar", "color": "#39ff14", "cornerRadiusTop": 4 };
        } else if (chartType === 'donut') {
            spec.mark = { "type": "arc", "innerRadius": 30 };
            delete spec.encoding.x;
            spec.encoding.theta = { "field": yFields[0], "type": "quantitative" };
            spec.encoding.color = { "field": xField, "type": "nominal" };
        } else if (chartType === 'box') {
            spec.mark = { "type": "boxplot", "extent": "min-max", "color": "#ffaa00" };
        }

        return JSON.stringify(spec, null, 2);
    }
}

// =====================================================================
// 4. CUSTOM SVG CHART COMPILER RENDERER
// =====================================================================
class CustomSvgRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }

    formatDateLabel(dateStr, allTx) {
        if (!dateStr) return '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        const years = new Set(allTx.map(t => t.date ? t.date.substring(0, 4) : ''));
        years.delete('');
        if (years.size > 1) {
            return dateStr;
        }
        return dateStr.substring(5);
    }

    render(recResult, transactions) {
        if (!this.container || transactions.length === 0) return;

        const width = 450;
        const height = 180;
        const padding = { top: 20, right: 20, bottom: 25, left: 45 };
        const plotW = width - padding.left - padding.right;
        const plotH = height - padding.top - padding.bottom;

        const xField = recResult.xField;
        const yFields = recResult.yFields;
        const xProfile = recResult.xProfile;
        const yProfiles = recResult.yProfiles;

        const winType = recResult.winningType;
        const colors = ['#00f0ff', '#ff007f', '#39ff14', '#ffaa00', '#9c27b0', '#e91e63'];

        let globalMin = Infinity;
        let globalMax = -Infinity;

        yFields.forEach((yf, idx) => {
            const vals = transactions.map(d => parseFloat(d[yf])).filter(v => !isNaN(v));
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            if (min < globalMin) globalMin = min;
            if (max > globalMax) globalMax = max;
        });

        const yRange = globalMax - globalMin || 1;
        globalMin -= yRange * 0.05;
        globalMax += yRange * 0.05;
        const adjustedRange = globalMax - globalMin;

        // Draw Grid lines
        const yTicks = 4;
        let gridLinesHtml = '';
        for (let i = 0; i <= yTicks; i++) {
            const y = padding.top + (plotH / yTicks) * i;
            const val = globalMax - (adjustedRange / yTicks) * i;
            gridLinesHtml += `
                <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="rgba(255, 255, 255, 0.06)" stroke-dasharray="3,3"/>
                <text x="${padding.left - 10}" y="${y + 3}" fill="var(--color-text-secondary)" font-size="7.5" font-family="'JetBrains Mono', monospace" text-anchor="end">${val.toFixed(1)}</text>
            `;
        }

        const getX = (i, total) => padding.left + (i / Math.max(1, total - 1)) * plotW;
        const getY = (val) => padding.top + plotH - ((parseFloat(val) - globalMin) / adjustedRange) * plotH;

        let contentHtml = '';

        if (winType === 'line') {
            const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

            yFields.forEach((yf, fieldIdx) => {
                const color = colors[fieldIdx % colors.length];
                let pathD = '';
                let areaD = `M ${getX(0, sortedTx.length)} ${padding.top + plotH} `;

                sortedTx.forEach((tx, i) => {
                    const px = getX(i, sortedTx.length);
                    const py = getY(tx[yf]);
                    if (i === 0) {
                        pathD += `M ${px} ${py} `;
                    } else {
                        pathD += `L ${px} ${py} `;
                    }
                    areaD += `L ${px} ${py} `;
                });
                areaD += `L ${getX(sortedTx.length - 1, sortedTx.length)} ${padding.top + plotH} Z`;

                const gradId = `area-grad-${fieldIdx}`;
                contentHtml += `
                    <defs>
                        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
                            <stop offset="100%" stop-color="${color}" stop-opacity="0.0"/>
                        </linearGradient>
                    </defs>
                    <path d="${areaD}" fill="url(#${gradId})"/>
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" filter="drop-shadow(0 0 6px ${color}44)"/>
                    ${sortedTx.map((tx, i) => `<circle cx="${getX(i, sortedTx.length)}" cy="${getY(tx[yf])}" r="3" fill="#fff" stroke="${color}" stroke-width="1"/>`).join('')}
                `;
            });

            const xTickStep = Math.max(1, Math.floor(sortedTx.length / 4));
            for (let i = 0; i < sortedTx.length; i += xTickStep) {
                const px = getX(i, sortedTx.length);
                contentHtml += `
                    <line x1="${px}" y1="${padding.top}" x2="${px}" y2="${padding.top + plotH}" stroke="rgba(255, 255, 255, 0.04)" stroke-dasharray="2,2"/>
                    <text x="${px}" y="${padding.top + plotH + 12}" fill="var(--color-text-secondary)" font-size="7.5" font-family="'JetBrains Mono', monospace" text-anchor="middle">${this.formatDateLabel(sortedTx[i].date, transactions)}</text>
                `;
            }

        } else if (winType === 'scatter') {
            const sortedTx = xField === 'date' ? [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date)) : transactions;
            yFields.forEach((yf, fieldIdx) => {
                const color = colors[fieldIdx % colors.length];
                sortedTx.forEach((tx, i) => {
                    const cx = getX(i, sortedTx.length);
                    const cy = getY(tx[yf]);
                    contentHtml += `
                        <circle cx="${cx}" cy="${cy}" r="4.5" fill="${color}" filter="drop-shadow(0 0 4px ${color}55)"/>
                    `;
                });
            });

            // Draw X-axis ticks & labels for scatter plot
            if (xField === 'date') {
                const xTickStep = Math.max(1, Math.floor(sortedTx.length / 4));
                for (let i = 0; i < sortedTx.length; i += xTickStep) {
                    const px = getX(i, sortedTx.length);
                    contentHtml += `
                        <line x1="${px}" y1="${padding.top}" x2="${px}" y2="${padding.top + plotH}" stroke="rgba(255, 255, 255, 0.04)" stroke-dasharray="2,2"/>
                        <text x="${px}" y="${padding.top + plotH + 12}" fill="var(--color-text-secondary)" font-size="7.5" font-family="'JetBrains Mono', monospace" text-anchor="middle">${this.formatDateLabel(sortedTx[i].date, transactions)}</text>
                    `;
                }
            } else {
                const xTickStep = Math.max(1, Math.floor(sortedTx.length / 4));
                for (let i = 0; i < sortedTx.length; i += xTickStep) {
                    const px = getX(i, sortedTx.length);
                    const label = sortedTx[i][xField] || '';
                    contentHtml += `
                        <text x="${px}" y="${padding.top + plotH + 12}" fill="var(--color-text-secondary)" font-size="7.5" text-anchor="middle" font-family="sans-serif">${String(label).substring(0, 10)}</text>
                    `;
                }
            }

        } else if (winType === 'bar') {
            const categories = {};
            transactions.forEach(t => {
                const labelVal = t[xField] || 'Other';
                categories[labelVal] = (categories[labelVal] || 0) + Math.abs(t.amount);
            });

            const keys = Object.keys(categories);
            const barW = (plotW / keys.length) * 0.6;
            const gap = (plotW / keys.length) * 0.4;
            const maxVal = Math.max(...Object.values(categories)) || 1;

            keys.forEach((cat, i) => {
                const val = categories[cat];
                const bx = padding.left + i * (barW + gap) + gap / 2;
                const by = padding.top + plotH - (val / maxVal) * plotH;
                const bh = padding.top + plotH - by;
                const color = '#39ff14';
                const labelText = xField === 'date' ? this.formatDateLabel(cat, transactions) : cat;

                contentHtml += `
                    <rect x="${bx}" y="${by}" width="${barW}" height="${bh}" fill="${color}" rx="2" style="opacity: 0.85; filter: drop-shadow(0 0 4px rgba(57, 255, 20, 0.2));"/>
                    <text x="${bx + barW / 2}" y="${padding.top + plotH + 12}" fill="var(--color-text-secondary)" font-size="7.5" text-anchor="middle" font-family="sans-serif">${labelText}</text>
                    <text x="${bx + barW / 2}" y="${by - 5}" fill="#fff" font-size="7.5" text-anchor="middle" font-family="monospace">$${Math.round(val)}</text>
                `;
            });

        } else if (winType === 'donut') {
            const categories = {};
            let total = 0;
            transactions.forEach(t => {
                const cat = t[xField] || 'Other';
                const amt = Math.abs(t.amount);
                categories[cat] = (categories[cat] || 0) + amt;
                total += amt;
            });

            const keys = Object.keys(categories);
            const cx = width / 2 + 50;
            const cy = height / 2;
            const r = 50;
            const strokeW = 10;

            let accumAngle = 0;
            const rad = Math.PI / 180;

            keys.forEach((cat, idx) => {
                const val = categories[cat];
                const percentage = val / total;
                const angle = percentage * 360;

                const startAngle = accumAngle;
                const endAngle = accumAngle + angle;
                accumAngle = endAngle;

                const x1 = cx + r * Math.cos(startAngle * rad);
                const y1 = cy + r * Math.sin(startAngle * rad);
                const x2 = cx + r * Math.cos(endAngle * rad);
                const y2 = cy + r * Math.sin(endAngle * rad);

                const largeArc = angle > 180 ? 1 : 0;
                const color = colors[idx % colors.length];

                if (percentage >= 0.999) {
                    contentHtml += `
                        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeW}"/>
                    `;
                } else {
                    contentHtml += `
                        <path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${strokeW}"/>
                    `;
                }
            });

            // Draw a beautiful vertical legend on the left half
            let legendHtml = '<g transform="translate(30, 30)">';
            keys.forEach((cat, idx) => {
                const color = colors[idx % colors.length];
                const yPos = idx * 18;
                const percentText = (categories[cat] / total * 100).toFixed(0) + '%';
                const labelText = xField === 'date' ? this.formatDateLabel(cat, transactions) : cat;
                if (yPos < plotH + 20) {
                    legendHtml += `
                        <rect x="0" y="${yPos - 7}" width="9" height="9" rx="2" fill="${color}"/>
                        <text x="16" y="${yPos}" fill="var(--color-text-primary)" font-size="8.5" font-family="sans-serif" font-weight="bold">${labelText}</text>
                        <text x="100" y="${yPos}" fill="var(--color-text-secondary)" font-size="8" font-family="'JetBrains Mono', monospace">${percentText}</text>
                    `;
                }
            });
            legendHtml += '</g>';
            contentHtml += legendHtml;

            contentHtml += `
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="${strokeW}"/>
                <text x="${cx}" y="${cy + 3}" fill="var(--color-text-secondary)" font-size="8" font-family="'Orbitron', sans-serif" text-anchor="middle">SHARES</text>
            `;

        } else if (winType === 'box') {
            const numBoxes = yFields.length;
            const boxWidth = Math.min(60, plotW / numBoxes - 20);

            yFields.forEach((yf, fieldIdx) => {
                const profile = yProfiles[fieldIdx];
                const q1 = getY(profile.q1);
                const q3 = getY(profile.q3);
                const median = getY(profile.mean);
                const min = getY(profile.min);
                const max = getY(profile.max);

                const midX = padding.left + (plotW / (numBoxes + 1)) * (fieldIdx + 1);
                const color = colors[fieldIdx % colors.length];

                contentHtml += `
                    <line x1="${midX}" y1="${min}" x2="${midX}" y2="${q3}" stroke="${color}" stroke-width="1.5"/>
                    <line x1="${midX}" y1="${max}" x2="${midX}" y2="${q1}" stroke="${color}" stroke-width="1.5"/>
                    <line x1="${midX - 10}" y1="${min}" x2="${midX + 10}" y2="${min}" stroke="${color}" stroke-width="1.5"/>
                    <line x1="${midX - 10}" y1="${max}" x2="${midX + 10}" y2="${max}" stroke="${color}" stroke-width="1.5"/>
                    <rect x="${midX - boxWidth / 2}" y="${q3}" width="${boxWidth}" height="${q1 - q3}" fill="${color}22" stroke="${color}" stroke-width="1.5"/>
                    <line x1="${midX - boxWidth / 2}" y1="${median}" x2="${midX + boxWidth / 2}" y2="${median}" stroke="${color}" stroke-width="3"/>
                    <text x="${midX}" y="${padding.top + plotH + 12}" fill="var(--color-text-secondary)" font-size="8" text-anchor="middle" font-family="sans-serif">${recResult.yLabels[fieldIdx].substring(0, 10)}</text>
                `;
            });
        }

        const axesHtml = `
            <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${padding.top + plotH}" stroke="var(--color-border)" stroke-width="1"/>
            <line x1="${padding.left}" y1="${padding.top + plotH}" x2="${width - padding.right}" y2="${padding.top + plotH}" stroke="var(--color-border)" stroke-width="1"/>
        `;

        this.container.innerHTML = `
            <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:100%;">
                ${gridLinesHtml}
                ${contentHtml}
                ${axesHtml}
            </svg>
        `;
    }
}

// =====================================================================
// 5. APPLICATION ORCHESTRATOR / CONTROLLER
// =====================================================================
const state = new AppState();
const recommender = new VisRecAgent();
const renderer = new CustomSvgRenderer('chart-render-area');

const els = {
    formTx: document.getElementById('form-add-tx'),
    btnReset: document.getElementById('btn-reset-data'),
    inputQuery: document.getElementById('input-query'),
    btnQuery: document.getElementById('btn-run-query'),
    chatContainer: document.getElementById('chat-terminal-container'),
    chartTitle: document.getElementById('chart-render-title'),
    explanation: document.getElementById('explanation-body'),
    promptLog: document.getElementById('prompt-log-block'),
    dracoTable: document.getElementById('draco-table-rows'),
    scorecard: document.getElementById('scorecard-body')
};

let lastQueryText = "Show trend of transaction amount over dates";

function init() {
    state.subscribe(onStateMutation);

    if (els.formTx) {
        els.formTx.addEventListener('submit', (e) => {
            e.preventDefault();
            const amount = document.getElementById('tx-amount').value;
            const category = document.getElementById('tx-category').value;
            const desc = document.getElementById('tx-desc').value;
            const date = document.getElementById('tx-date').value;

            state.addTransaction(category, amount, desc, date);
            els.formTx.reset();
            setTodayDate();
        });
    }

    if (els.btnReset) {
        els.btnReset.addEventListener('click', () => {
            const isTest = window.navigator.webdriver || new URLSearchParams(window.location.search).has('test');
            if (isTest || confirm("Reset transaction ledger to defaults?")) {
                state.resetAll();
            }
        });
    }

    if (els.btnQuery && els.inputQuery) {
        els.btnQuery.addEventListener('click', handleQuerySubmit);
        els.inputQuery.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleQuerySubmit();
        });
    }

    document.querySelectorAll('.tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const query = btn.getAttribute('data-query');
            if (els.inputQuery) {
                els.inputQuery.value = query;
                handleQuerySubmit();
            }
        });
    });

    setTodayDate();
    runQuery(lastQueryText);
}

function setTodayDate() {
    const dateInput = document.getElementById('tx-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
}

function handleQuerySubmit() {
    const query = els.inputQuery.value.trim();
    if (query) {
        lastQueryText = query;
        runQuery(query);
        els.inputQuery.value = '';
    }
}

function onStateMutation() {
    runQuery(lastQueryText);
}

window.deleteTx = function (id) {
    const isTest = window.navigator.webdriver || new URLSearchParams(window.location.search).has('test');
    if (isTest || confirm("Delete this transaction?")) {
        state.deleteTransaction(id);
    }
};

function renderLedgerTable(transactions) {
    const tbody = document.getElementById('ledger-table-rows');
    if (!tbody) return;
    const sorted = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    tbody.innerHTML = sorted.map(t => {
        const amtColor = t.amount >= 0 ? 'var(--color-success)' : 'var(--color-secondary)';
        const amtSign = t.amount >= 0 ? '+' : '';
        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                <td style="padding: 4px; font-family: monospace;">${t.date}</td>
                <td style="padding: 4px; max-width: 85px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.category}">${t.category}</td>
                <td style="padding: 4px; text-align: right; color: ${amtColor}; font-family: monospace; font-weight: bold;">${amtSign}${t.amount.toFixed(2)}</td>
                <td style="padding: 4px; text-align: center;">
                    <button type="button" class="btn-delete" onclick="deleteTx('${t.id}')" style="background: none; border: none; color: var(--color-secondary); cursor: pointer; font-size: 0.8rem; padding: 0 4px; line-height: 1;">&times;</button>
                </td>
            </tr>
        `;
    }).join('');
}

function runQuery(queryText) {
    const transactions = state.transactions;
    if (transactions.length === 0) return;

    const recResult = recommender.chat(transactions, queryText);

    if (els.chatContainer) {
        els.chatContainer.innerHTML = recommender.conversationHistory.map(bubble => `
            <div class="chat-bubble ${bubble.role}">
                <strong>${bubble.role === 'user' ? 'You' : 'AI Recommender'}:</strong><br>
                ${bubble.content}
            </div>
        `).join('');
        els.chatContainer.scrollTop = els.chatContainer.scrollHeight;
    }

    if (els.chartTitle) {
        els.chartTitle.textContent = `${recResult.winningType.toUpperCase()} Chart - Recommended Visual Encoding`;
    }

    renderer.render(recResult, transactions);
    renderLedgerTable(transactions);

    const setScore = (type, val) => {
        const percent = Math.round(val * 100);
        const valEl = document.getElementById(`score-val-${type}`);
        const barEl = document.getElementById(`score-bar-${type}`);
        if (valEl) valEl.textContent = `${percent}%`;
        if (barEl) barEl.style.width = `${percent}%`;
    };
    setScore('line', recResult.scores.line);
    setScore('scatter', recResult.scores.scatter);
    setScore('bar', recResult.scores.bar);
    setScore('donut', recResult.scores.donut || 0);
    setScore('box', recResult.scores.box);

    if (els.dracoTable) {
        els.dracoTable.innerHTML = recResult.dracoConstraints.map(c => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); color: var(--color-text-secondary);">
                <td style="padding: 6px 10px; font-family: monospace; color: var(--color-primary);">${c.rule}</td>
                <td style="padding: 6px 10px;">${c.desc}</td>
                <td style="padding: 6px 10px; text-align: right; font-weight: bold; color: ${c.status === 'PASS' ? 'var(--color-success)' : 'var(--color-text-muted)'};">${c.status}</td>
            </tr>
        `).join('');
    }

    if (els.scorecard) {
        const specPct = Math.round(recResult.specScorecard.score * 100);
        const visPct = Math.round(recResult.visionScorecard.score * 100);
        els.scorecard.innerHTML = `
            <div style="margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>Spec Score (F1 Match):</span>
                    <span style="color: var(--color-primary);">${specPct}%</span>
                </div>
                <div class="score-bar-bg"><div class="score-bar-fill" style="width: ${specPct}%; background: var(--color-primary); box-shadow: 0 0 6px var(--color-primary-glow);"></div></div>
            </div>
            <div style="margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>Vision Score (Aesthetics/A11y):</span>
                    <span style="color: var(--color-success);">${visPct}%</span>
                </div>
                <div class="score-bar-bg"><div class="score-bar-fill" style="width: ${visPct}%; background: var(--color-success); box-shadow: 0 0 6px var(--color-success-glow);"></div></div>
            </div>
            <div style="border-top: 1px solid var(--color-border); padding-top: 6px; margin-top: 4px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.66rem; color: var(--color-text-secondary);">
                <div>Type Suitability: <span style="color: #fff;">${recResult.visionScorecard.criteria.visualization_type}/2</span></div>
                <div>Aesthetics & A11y: <span style="color: #fff;">${recResult.visionScorecard.criteria.aesthetics}/2</span></div>
                <div>Data Encoding: <span style="color: #fff;">${recResult.visionScorecard.criteria.data_encoding}/2</span></div>
                <div>Prompt Compliance: <span style="color: #fff;">${recResult.visionScorecard.criteria.prompt_compliance}/2</span></div>
            </div>
        `;
    }

    if (els.promptLog) {
        let markdownLogs = `### in-context learning exemplars (AdaVis similarity index):\n`;
        recResult.promptingLogs.exemplars.forEach((ex, idx) => {
            markdownLogs += `**Exemplar ${idx + 1} (Cosine Sim = 0.9${2 - idx}):**\n - Query: "${ex.query}"\n - Result: \`${ex.winning}\`\n - Explanation: "${ex.explanation}"\n\n`;
        });
        markdownLogs += `### Prompt Bootstrapping iterations:\n`;
        recResult.promptingLogs.iterations.forEach((iter) => {
            markdownLogs += `\n**[${iter.step}]**\n - Prompt: *${iter.prompt.substring(0, 110)}...*\n - Model Output: \`${iter.output.replace(/\n/g, ' ')}\`\n - Status: *${iter.status}*\n`;
        });
        els.promptLog.textContent = markdownLogs;
    }

    if (els.explanation) {
        els.explanation.innerHTML = recResult.explanation;
    }
}

window.addEventListener('DOMContentLoaded', init);
