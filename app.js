document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. Navigation & Header Handling
    // ==========================================
    const header = document.querySelector('.main-header');
    const navMenu = document.getElementById('nav-menu');
    const mobileToggle = document.getElementById('mobile-toggle');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section');

    // Scroll effect for header
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        // Active Nav Link highlight on scroll
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.scrollY >= (sectionTop - 150)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').slice(1) === current) {
                link.classList.add('active');
            }
        });
    });

    // Mobile menu toggle
    mobileToggle.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        mobileToggle.classList.toggle('active');

        // Morph hamburger menu icon
        const lines = mobileToggle.querySelectorAll('line');
        if (navMenu.classList.contains('active')) {
            lines[0].setAttribute('x1', '18'); lines[0].setAttribute('y1', '6'); lines[0].setAttribute('x2', '6'); lines[0].setAttribute('y2', '18');
            lines[1].setAttribute('opacity', '0');
            lines[2].setAttribute('x1', '6'); lines[2].setAttribute('y1', '6'); lines[2].setAttribute('x2', '18'); lines[2].setAttribute('y2', '18');
        } else {
            lines[0].setAttribute('x1', '3'); lines[0].setAttribute('y1', '12'); lines[0].setAttribute('x2', '21'); lines[0].setAttribute('y2', '12');
            lines[1].setAttribute('opacity', '1');
            lines[2].setAttribute('x1', '3'); lines[2].setAttribute('y1', '18'); lines[2].setAttribute('x2', '21'); lines[2].setAttribute('y2', '18');
        }
    });

    // Close mobile menu on link click
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            mobileToggle.classList.remove('active');
            const lines = mobileToggle.querySelectorAll('line');
            lines[0].setAttribute('x1', '3'); lines[0].setAttribute('y1', '12'); lines[0].setAttribute('x2', '21'); lines[0].setAttribute('y2', '12');
            lines[1].setAttribute('opacity', '1');
            lines[2].setAttribute('x1', '3'); lines[2].setAttribute('y1', '18'); lines[2].setAttribute('x2', '21'); lines[2].setAttribute('y2', '18');
        });
    });

    // ==========================================
    // 2. Menu Category Filtering
    // ==========================================
    const filterButtons = document.querySelectorAll('.filter-btn');
    const menuCards = document.querySelectorAll('.menu-card');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state of button
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.getAttribute('data-filter');

            menuCards.forEach(card => {
                const category = card.getAttribute('data-category');

                // Reset animation properties
                card.style.opacity = '0';
                card.style.transform = 'translateY(15px)';

                setTimeout(() => {
                    if (filter === 'all' || category === filter) {
                        card.classList.remove('hidden');
                        // Trigger reflow to restart transition
                        void card.offsetWidth;
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    } else {
                        card.classList.add('hidden');
                    }
                }, 200);
            });
        });
    });

    // ==========================================
    // 3. Coffee Customizer Logic
    // ==========================================
    const customizerSection = document.getElementById('customizer');
    const baseBtns = document.querySelectorAll('#base-options .custom-opt-btn');
    const milkBtns = document.querySelectorAll('#milk-options .custom-opt-btn');
    const syrupBtns = document.querySelectorAll('#syrup-options .custom-opt-btn');
    const shotsSlider = document.getElementById('shots-range');
    const shotsCount = document.getElementById('shots-count');
    const shotsContainer = document.getElementById('shots-slider-container');

    // Summaries & Previews
    const summaryBase = document.getElementById('summary-base');
    const summaryAddons = document.getElementById('summary-addons');
    const summaryTotal = document.getElementById('summary-total');

    const cupFoam = document.getElementById('layer-foam');
    const cupMilk = document.getElementById('layer-milk');
    const cupBase = document.getElementById('layer-base');
    const cupLiquidContainer = document.querySelector('.cup-liquids');

    const specBase = document.getElementById('spec-base');
    const specMilk = document.getElementById('spec-milk');
    const specsList = document.getElementById('specs-list');

    // Current State values
    let currentBase = 'espresso';
    let currentMilk = 'whole';
    let currentSyrup = 'none';
    let currentShots = 1;

    let basePrice = 40;
    let milkPrice = 0;
    let syrupPrice = 0;
    let shotPrice = 0; // Extra decoction is +₹10

    // Customizer config mapped values
    const drinkConfig = {
        espresso: {
            name: 'Filter Coffee',
            color: 'var(--color-espresso)',
            basePrice: 40,
            hasMilkOption: true,
            hasShots: true
        },
        matcha: {
            name: 'Sukku Malli Tea',
            color: '#c29e67', // golden ginger brown
            basePrice: 35,
            hasMilkOption: true,
            hasShots: false
        },
        chocolate: {
            name: 'Rose Milk',
            color: '#f3a3b5', // pink rose milk
            basePrice: 50,
            hasMilkOption: true,
            hasShots: false
        }
    };

    const milkNames = {
        whole: "Fresh Cow's Milk",
        oat: "Badam Milk",
        almond: "Almond Milk",
        coconut: "Coconut Milk"
    };

    const syrupNames = {
        none: 'No Extra Sweeteners',
        vanilla: 'Palm Jaggery (Karupatti)',
        caramel: 'Organic Cane Jaggery (Vellam)',
        sugar: 'Country Sugar (Naatu Sakkarai)',
        honey: 'Local Honey'
    };

    // Calculate Prices & Update UI
    function updateCustomizer() {
        // Calculate Addons
        // If filter coffee, 1 decoction shot is free, extra are ₹10 each
        shotPrice = (currentBase === 'espresso' && currentShots > 1) ? (currentShots - 1) * 10 : 0;
        const addonsTotal = milkPrice + syrupPrice + shotPrice;
        const total = basePrice + addonsTotal;

        // Render prices
        summaryBase.textContent = `₹${basePrice.toFixed(0)}`;
        summaryAddons.textContent = `₹${addonsTotal.toFixed(0)}`;
        summaryTotal.textContent = `₹${total.toFixed(0)}`;

        // Update Spec Text Card
        specBase.textContent = `${drinkConfig[currentBase].name} Base`;
        if (currentBase === 'espresso') {
            const shotLabels = ['Single Decoction Strength', 'Double Decoction Strength', 'Triple Decoction Strength', 'Quad Decoction Strength'];
            specBase.textContent += ` (${shotLabels[currentShots - 1]})`;
        }

        // Milk display label
        specMilk.textContent = currentMilk === 'none' ? 'No Milk' : `${milkNames[currentMilk]}`;

        // Re-construct the list details
        const syrupText = currentSyrup === 'none' ? 'No Extra Sweeteners' : `Sweetener: ${syrupNames[currentSyrup]}`;
        const addOnText = (addonsTotal > 0) ? `Add-ons total: ₹${addonsTotal.toFixed(0)}` : 'Standard recipe pricing';

        specsList.innerHTML = `
            <li><strong>${specBase.textContent}</strong></li>
            <li><strong>${specMilk.textContent}</strong></li>
            <li>${syrupText}</li>
            <li>${addOnText}</li>
        `;

        // Update Cup Visual Graphic
        updateCupGraphic();
    }

    // Visual Cup Graphic renderer
    function updateCupGraphic() {
        const config = drinkConfig[currentBase];

        // Base liquid color change
        document.documentElement.style.setProperty('--color-base', config.color);

        // Update layer labels
        cupBase.querySelector('.layer-label').textContent = config.name;
        cupMilk.querySelector('.layer-label').textContent = currentMilk === 'none' ? '' : `${milkNames[currentMilk]}`;

        // Adjust heights of layers inside cup
        if (currentMilk === 'none') {
            // Just base liquid
            document.documentElement.style.setProperty('--base-height', '90%');
            document.documentElement.style.setProperty('--milk-height', '0%');
            document.documentElement.style.setProperty('--foam-height', '10%'); // thin crema layer
            cupFoam.querySelector('.layer-label').textContent = currentBase === 'espresso' ? 'Decoction Crema' : 'Bubbles';
        } else {
            // Standard drink logic
            if (currentBase === 'espresso') {
                // Filter Coffee styling (highly frothy!)
                document.documentElement.style.setProperty('--base-height', '30%');
                document.documentElement.style.setProperty('--milk-height', '45%');
                document.documentElement.style.setProperty('--foam-height', '25%'); // extra frothy
                cupFoam.querySelector('.layer-label').textContent = 'Degree Froth';
            } else if (currentBase === 'matcha') {
                // Sukku tea styling
                document.documentElement.style.setProperty('--base-height', '50%');
                document.documentElement.style.setProperty('--milk-height', '40%');
                document.documentElement.style.setProperty('--foam-height', '10%');
                cupFoam.querySelector('.layer-label').textContent = 'Steam';
            } else if (currentBase === 'chocolate') {
                // Rose milk cooler (no froth, basil seeds on top)
                document.documentElement.style.setProperty('--base-height', '70%');
                document.documentElement.style.setProperty('--milk-height', '20%');
                document.documentElement.style.setProperty('--foam-height', '10%');
                cupFoam.querySelector('.layer-label').textContent = 'Basil Seeds / Petals';
            }
        }

        // Smooth scaling visual effect when changing base
        cupLiquidContainer.style.transform = 'scale(0.98)';
        setTimeout(() => {
            cupLiquidContainer.style.transform = 'scale(1)';
        }, 100);
    }

    // Helper functions
    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // Option Buttons Click Listeners
    baseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            baseBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentBase = btn.getAttribute('data-base');
            basePrice = parseFloat(btn.getAttribute('data-price'));

            // Toggle Shots slider visibility (Only Espresso has shot modifications)
            if (drinkConfig[currentBase].hasShots) {
                shotsContainer.style.opacity = '1';
                shotsContainer.style.pointerEvents = 'auto';
            } else {
                shotsContainer.style.opacity = '0.3';
                shotsContainer.style.pointerEvents = 'none';
                currentShots = 1;
                shotsSlider.value = 1;
                shotsCount.textContent = '1 Shot';
            }

            updateCustomizer();
        });
    });

    milkBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            milkBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentMilk = btn.getAttribute('data-milk');
            milkPrice = parseFloat(btn.getAttribute('data-price'));

            updateCustomizer();
        });
    });

    syrupBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            syrupBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentSyrup = btn.getAttribute('data-syrup');
            syrupPrice = parseFloat(btn.getAttribute('data-price'));

            updateCustomizer();
        });
    });

    // Slider range changes
    shotsSlider.addEventListener('input', (e) => {
        currentShots = parseInt(e.target.value);
        const labels = ['Single Decoction', 'Double Decoction', 'Triple Decoction', 'Quad Decoction'];
        shotsCount.textContent = labels[currentShots - 1];

        updateCustomizer();
    });

    // "Add to Order" animation feedback
    const btnOrder = document.getElementById('btn-add-order');
    btnOrder.addEventListener('click', () => {
        const originalText = btnOrder.innerHTML;
        btnOrder.style.backgroundColor = 'var(--success)';
        btnOrder.style.borderColor = 'var(--success)';
        btnOrder.style.color = '#fff';
        btnOrder.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 8px; vertical-align: middle;">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg> Added to Order!
        `;

        // Sparkle animation scale
        cupLiquidContainer.style.animation = 'float 0.5s ease-in-out';
        setTimeout(() => {
            cupLiquidContainer.style.animation = '';
        }, 500);

        setTimeout(() => {
            btnOrder.style.backgroundColor = '';
            btnOrder.style.borderColor = '';
            btnOrder.style.color = '';
            btnOrder.innerHTML = originalText;
        }, 2000);
    });

    // Pre-filling customizer from menu cards
    const customizeBtns = document.querySelectorAll('.customize-link-btn');
    customizeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Set custom states according to drink item
            if (drinkType === 'filter-coffee') {
                triggerBaseClick('espresso');
                triggerMilkClick('whole');
                triggerSyrupClick('none');
                setShotsValue(2); // double decoction is standard
            } else if (drinkType === 'karupatti-coffee') {
                triggerBaseClick('espresso');
                triggerMilkClick('whole');
                triggerSyrupClick('vanilla'); // palm jaggery
                setShotsValue(2);
            } else if (drinkType === 'rose-milk') {
                triggerBaseClick('chocolate');
                triggerMilkClick('whole');
                triggerSyrupClick('none');
            } else if (drinkType === 'sukku-tea') {
                triggerBaseClick('matcha');
                triggerMilkClick('whole');
                triggerSyrupClick('honey');
            }

            // Smooth scroll to customizer section
            document.getElementById('customizer').scrollIntoView({ behavior: 'smooth' });
        });
    });

    function triggerBaseClick(baseName) {
        const targetBtn = document.querySelector(`#base-options button[data-base="${baseName}"]`);
        if (targetBtn) targetBtn.click();
    }

    function triggerMilkClick(milkName) {
        const targetBtn = document.querySelector(`#milk-options button[data-milk="${milkName}"]`);
        if (targetBtn) targetBtn.click();
    }

    function triggerSyrupClick(syrupName) {
        const targetBtn = document.querySelector(`#syrup-options button[data-syrup="${syrupName}"]`);
        if (targetBtn) targetBtn.click();
    }

    function setShotsValue(val) {
        shotsSlider.value = val;
        currentShots = val;
        const labels = ['Single Shot', 'Double Shot', 'Triple Shot', 'Quad Shot'];
        shotsCount.textContent = labels[val - 1];
        updateCustomizer();
    }

    // Initialize customizer on page load
    updateCustomizer();


    // ==========================================
    // 4. Reservation Form Handling
    // ==========================================
    const bookingForm = document.getElementById('booking-form');
    const bookingSuccess = document.getElementById('booking-success');
    const submitBtn = document.getElementById('booking-submit-btn');
    const resetBookingBtn = document.getElementById('btn-reset-booking');

    // Restrict date input to today and onwards
    const dateInput = document.getElementById('booking-date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
    dateInput.value = today;

    bookingForm.addEventListener('submit', (e) => {
        e.preventDefault();

        // Inputs
        const nameVal = document.getElementById('booking-name').value;
        const emailVal = document.getElementById('booking-email').value;
        const dateVal = document.getElementById('booking-date').value;
        const timeSelect = document.getElementById('booking-time');
        const timeVal = timeSelect.options[timeSelect.selectedIndex].text;
        const guestsSelect = document.getElementById('booking-guests');
        const guestsVal = guestsSelect.options[guestsSelect.selectedIndex].text;

        // Show Loader Spinner state
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoader = submitBtn.querySelector('.btn-loader');

        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
        submitBtn.setAttribute('disabled', 'true');

        // Simulate server communication latency
        setTimeout(() => {
            // Hide Form, Show Success Card
            bookingForm.classList.add('hidden');
            bookingSuccess.classList.remove('hidden');

            // Populate summary voucher
            document.getElementById('success-name-val').textContent = nameVal;
            document.getElementById('success-email-val').textContent = emailVal;
            document.getElementById('success-date-val').textContent = dateVal;
            document.getElementById('success-time-val').textContent = timeVal;
            document.getElementById('success-guests-val').textContent = guestsVal;

            // Reset form loader states
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
            submitBtn.removeAttribute('disabled');
        }, 1500);
    });

    // Reset Table Booking Form
    resetBookingBtn.addEventListener('click', () => {
        bookingForm.reset();
        dateInput.value = today;
        bookingSuccess.classList.add('hidden');
        bookingForm.classList.remove('hidden');
    });


    // ==========================================
    // 5. Testimonial Carousel
    // ==========================================
    const slides = document.querySelectorAll('.testimonial-slide');
    const dots = document.querySelectorAll('.carousel-dot');
    const prevBtn = document.getElementById('prev-slide');
    const nextBtn = document.getElementById('next-slide');
    let currentSlide = 0;
    let carouselInterval;

    function showSlide(index) {
        slides.forEach(slide => {
            slide.classList.remove('active');
            slide.style.opacity = '0';
            slide.style.transform = 'translateX(50px)';
        });
        dots.forEach(dot => dot.classList.remove('active'));

        currentSlide = (index + slides.length) % slides.length;

        slides[currentSlide].classList.add('active');
        // Small delay to trigger transition smoothly
        setTimeout(() => {
            slides[currentSlide].style.opacity = '1';
            slides[currentSlide].style.transform = 'translateX(0)';
        }, 50);

        dots[currentSlide].classList.add('active');
    }

    function startCarouselTimer() {
        clearInterval(carouselInterval);
        carouselInterval = setInterval(() => {
            showSlide(currentSlide + 1);
        }, 6000);
    }

    // Button controls
    prevBtn.addEventListener('click', () => {
        showSlide(currentSlide - 1);
        startCarouselTimer();
    });

    nextBtn.addEventListener('click', () => {
        showSlide(currentSlide + 1);
        startCarouselTimer();
    });

    // Dot indicators clicks
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.getAttribute('data-slide'));
            showSlide(index);
            startCarouselTimer();
        });
    });

    // Initiate testimonial rotation
    startCarouselTimer();
});
