/* ============================================================
   MATTER & HILL GARTEN — Main JavaScript
   Scroll reveals, navigation, counters, FAQ, mobile menu
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // === LOADER ===
  const loader = document.querySelector('.loader');
  if (loader) {
    window.addEventListener('load', () => {
      setTimeout(() => loader.classList.add('loaded'), 400);
    });
    // Failsafe
    setTimeout(() => loader.classList.add('loaded'), 2500);
  }

  // === HEADER SCROLL ===
  const header = document.querySelector('.header');
  const scrollThreshold = 80;

  function handleHeaderScroll() {
    if (window.scrollY > scrollThreshold) {
      header.classList.add('header--scrolled');
    } else {
      header.classList.remove('header--scrolled');
    }
  }

  window.addEventListener('scroll', handleHeaderScroll, { passive: true });
  handleHeaderScroll();

  // === MOBILE MENU ===
  const hamburger = document.querySelector('.hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileMenu.classList.toggle('open');
      document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    });

    // Close menu on link click
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // === SCROLL REVEAL ===
  const animatedElements = document.querySelectorAll('[data-animate]');
  
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  animatedElements.forEach(el => revealObserver.observe(el));

  // === STAGGER CHILDREN ===
  document.querySelectorAll('.stagger').forEach(container => {
    const children = container.children;
    Array.from(children).forEach((child, i) => {
      child.style.setProperty('--stagger-index', i);
    });
    // Also observe stagger container for reveal
    revealObserver.observe(container);
  });

  // === COUNTER ANIMATION ===
  const counters = document.querySelectorAll('[data-count]');
  
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.getAttribute('data-count'));
        const suffix = el.getAttribute('data-suffix') || '';
        const prefix = el.getAttribute('data-prefix') || '';
        const duration = 2000;
        const fps = 60;
        const totalFrames = Math.round(duration / (1000 / fps));
        let frame = 0;
        
        const counter = setInterval(() => {
          frame++;
          const progress = frame / totalFrames;
          const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
          const current = Math.round(target * eased);
          el.textContent = prefix + current + suffix;
          
          if (frame === totalFrames) {
            clearInterval(counter);
            el.textContent = prefix + target + suffix;
          }
        }, 1000 / fps);
        
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => counterObserver.observe(el));

  // === FAQ ACCORDION ===
  document.querySelectorAll('.faq__question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq__item');
      const isOpen = item.classList.contains('open');
      
      // Close all
      document.querySelectorAll('.faq__item').forEach(i => i.classList.remove('open'));
      
      // Toggle current
      if (!isOpen) {
        item.classList.add('open');
      }
    });
  });

  // === SMOOTH SCROLL for anchor links ===
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const offset = header ? header.offsetHeight + 20 : 20;
        const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  // === HERO MOUSE TRACKING GRADIENT ===
  const heroSection = document.querySelector('.hero');
  const mouseGradient = document.querySelector('.hero__mouse-gradient');
  
  if (heroSection && mouseGradient) {
    heroSection.addEventListener('mousemove', (e) => {
      const rect = heroSection.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      mouseGradient.style.setProperty('--mouse-x', x + '%');
      mouseGradient.style.setProperty('--mouse-y', y + '%');
    });
  }

  // === CURSOR SPOTLIGHT ===
  const spotlight = document.querySelector('.cursor-spotlight');
  
  if (spotlight && window.matchMedia('(pointer: fine)').matches) {
    document.addEventListener('mousemove', (e) => {
      spotlight.style.left = e.clientX + 'px';
      spotlight.style.top = e.clientY + 'px';
    });

    document.addEventListener('mouseenter', () => spotlight.classList.add('active'));
    document.addEventListener('mouseleave', () => spotlight.classList.remove('active'));

    // Activate after a short delay to prevent initial flash
    setTimeout(() => spotlight.classList.add('active'), 500);
  }

  // === STICKY CTA BAR (Mobile) ===
  const stickyCta = document.querySelector('.sticky-cta');
  
  if (stickyCta) {
    const heroEl = document.querySelector('.hero');
    if (heroEl) {
      const stickyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting && window.scrollY > 200) {
            stickyCta.classList.add('visible');
          } else {
            stickyCta.classList.remove('visible');
          }
        });
      });
      stickyObserver.observe(heroEl);
    } else {
      // No hero on this page — show sticky CTA after short scroll
      window.addEventListener('scroll', () => {
        if (window.scrollY > 150) {
          stickyCta.classList.add('visible');
        } else {
          stickyCta.classList.remove('visible');
        }
      }, { passive: true });
    }
  }

  // === ACTIVE NAV STATE ===
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__link, .mobile-menu__link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('nav__link--active');
    }
  });

  // === CONTACT FORM ===
  const contactForm = document.querySelector('#contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector('button[type="submit"]');
      const originalText = btn.textContent;

      // Remove any previous status/error messages
      const oldMsg = contactForm.querySelector('.form-status-msg');
      if (oldMsg) oldMsg.remove();
      contactForm.querySelectorAll('.form-field-error').forEach(el => el.remove());
      contactForm.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

      // Collect form data
      const payload = {
        vorname: contactForm.querySelector('[name="vorname"]')?.value?.trim() || '',
        nachname: contactForm.querySelector('[name="nachname"]')?.value?.trim() || '',
        email: contactForm.querySelector('[name="email"]')?.value?.trim() || '',
        telefon: contactForm.querySelector('[name="telefon"]')?.value?.trim() || '',
        leistung: contactForm.querySelector('[name="leistung"]')?.value?.trim() || '',
        nachricht: contactForm.querySelector('[name="nachricht"]')?.value?.trim() || '',
        website: contactForm.querySelector('[name="website"]')?.value || '',
      };

      // Client-side validation
      const errors = [];
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      function showFieldError(fieldName, message) {
        const field = contactForm.querySelector(`[name="${fieldName}"]`);
        if (field) {
          field.classList.add('input-error');
          const errEl = document.createElement('span');
          errEl.className = 'form-field-error';
          errEl.style.cssText = 'color: #c53030; font-size: 0.85rem; display: block; margin-top: 0.25rem;';
          errEl.textContent = message;
          field.parentElement.appendChild(errEl);
        }
        errors.push(message);
      }

      if (!payload.vorname) showFieldError('vorname', 'Bitte geben Sie Ihren Vornamen ein.');
      if (!payload.nachname) showFieldError('nachname', 'Bitte geben Sie Ihren Nachnamen ein.');
      if (!payload.email) {
        showFieldError('email', 'Bitte geben Sie Ihre E-Mail-Adresse ein.');
      } else if (!emailPattern.test(payload.email)) {
        showFieldError('email', 'Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      }
      if (!payload.nachricht) showFieldError('nachricht', 'Bitte geben Sie eine Nachricht ein.');

      if (errors.length > 0) {
        return;
      }

      // Loading state
      btn.textContent = 'Wird gesendet...';
      btn.disabled = true;
      btn.style.opacity = '0.7';

      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (response.ok) {
          // Success
          btn.textContent = '✓ Nachricht gesendet!';
          btn.style.background = 'var(--green-600)';
          btn.style.opacity = '1';
          contactForm.reset();

          const successMsg = document.createElement('p');
          successMsg.className = 'form-status-msg';
          successMsg.style.cssText = 'color: var(--green-600); margin-top: var(--space-sm); font-size: 0.95rem;';
          successMsg.textContent = 'Vielen Dank! Wir melden uns innerhalb von 24 Stunden bei Ihnen.';
          btn.parentElement.appendChild(successMsg);

          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.disabled = false;
            successMsg.remove();
          }, 5000);
        } else {
          throw new Error(result.error || 'Unbekannter Fehler');
        }
      } catch (err) {
        // Error
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.opacity = '1';
        btn.disabled = false;

        const errorMsg = document.createElement('p');
        errorMsg.className = 'form-status-msg';
        errorMsg.style.cssText = 'color: #c53030; margin-top: var(--space-sm); font-size: 0.95rem;';
        errorMsg.textContent = err.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.';
        btn.parentElement.appendChild(errorMsg);

        setTimeout(() => errorMsg.remove(), 6000);
      }
    });
  }

  // === IMAGE LAZY LOADING ANIMATION ===
  document.querySelectorAll('img[loading="lazy"]').forEach(img => {
    // Don't add opacity manipulation to images inside reveal containers
    // as the parent [data-animate] already handles visibility
    if (img.closest('[data-animate]')) return;
    
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.5s ease';
    
    if (img.complete) {
      img.style.opacity = '1';
    } else {
      img.addEventListener('load', () => {
        img.style.opacity = '1';
      });
    }
  });

  // === CONSOLE EASTER EGG ===
  console.log(
    '%c🌿 Matter & Hill Garten GmbH — Website crafted with precision and care.\n%c062 511 28 29 | info@matterhillgarten.ch',
    'font-size: 14px; color: #244721; font-weight: bold; padding: 4px 0;',
    'font-size: 11px; color: #5a5540; padding: 4px 0;'
  );

});
