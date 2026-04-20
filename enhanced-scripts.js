/**
 * Enhanced Scripts - Domédicos del Norte
 * Mejoras de rendimiento y experiencia de usuario
 */

// Esperar a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', function() {
    
    // =========================
    // LAZY LOADING PARA IMÁGENES
    // =========================
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    
                    // Cargar imagen
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    
                    // Remover observer una vez cargada
                    observer.unobserve(img);
                    
                    // Agregar efecto de fade-in
                    img.classList.add('loaded');
                }
            });
        }, {
            rootMargin: '50px 0px',
            threshold: 0.01
        });

        // Observar todas las imágenes con data-src
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }

    // =========================
    // ANIMACIONES SCROLL REVEAL
    // =========================
    const revealElements = document.querySelectorAll('.scroll-reveal');
    
    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        revealElements.forEach(element => {
            revealObserver.observe(element);
        });
    }

    // =========================
    // BUSCADOR DE PRODUCTOS
    // =========================
    const searchInput = document.getElementById('product-search');
    const productCards = document.querySelectorAll('.article');
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            
            productCards.forEach(card => {
                const title = card.querySelector('.article-title')?.textContent.toLowerCase() || '';
                const description = card.querySelector('.article-description')?.textContent.toLowerCase() || '';
                
                if (title.includes(searchTerm) || description.includes(searchTerm)) {
                    card.style.display = 'block';
                    card.classList.add('search-match');
                } else {
                    card.style.display = 'none';
                    card.classList.remove('search-match');
                }
            });
            
            // Mostrar mensaje si no hay resultados
            const visibleCards = document.querySelectorAll('.article[style="display: block;"]');
            const noResults = document.getElementById('no-results');
            
            if (noResults) {
                noResults.style.display = visibleCards.length === 0 ? 'block' : 'none';
            }
        });
    }

    // =========================
    // FILTRO POR CATEGORÍA
    // =========================
    const categoryFilters = document.querySelectorAll('.category-filter');
    
    categoryFilters.forEach(filter => {
        filter.addEventListener('click', function(e) {
            e.preventDefault();
            
            const category = this.dataset.category;
            
            // Actualizar estado activo
            categoryFilters.forEach(f => f.classList.remove('active'));
            this.classList.add('active');
            
            // Filtrar productos
            productCards.forEach(card => {
                if (category === 'all' || card.dataset.category === category) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // =========================
    // MEJORAR ACCESIBILIDAD
    // =========================
    
    // Skip to content link
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.textContent = 'Saltar al contenido principal';
    skipLink.className = 'skip-link';
    document.body.insertBefore(skipLink, document.body.firstChild);
    
    // Mejorar navegación por teclado
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Tab') {
            document.body.classList.add('keyboard-navigation');
        }
    });
    
    document.addEventListener('mousedown', function() {
        document.body.classList.remove('keyboard-navigation');
    });

    // =========================
    // PERFORMANCE MONITORING
    // =========================
    
    // Medir tiempo de carga
    window.addEventListener('load', function() {
        const loadTime = performance.now();
        
        // Enviar a analytics si está disponible
        if (typeof gtag !== 'undefined') {
            gtag('event', 'page_load_time', {
                custom_parameter: loadTime.toFixed(2)
            });
        }
    });

    // =========================
    // OPTIMIZACIÓN DE IMÁGENES
    // =========================
    
    // Convertir imágenes a WebP si el navegador lo soporta
    function supportsWebP() {
        return new Promise(resolve => {
            const webP = new Image();
            webP.onload = webP.onerror = () => {
                resolve(webP.height === 2);
            };
            webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        });
    }

    supportsWebP().then(supported => {
        if (supported) {
            document.querySelectorAll('img[data-webp]').forEach(img => {
                img.src = img.dataset.webp;
            });
        }
    });

    // =========================
    // MICROINTERACCIONES
    // =========================
    
    // Efecto ripple en botones
    document.querySelectorAll('.btn-cotizar, .btn-primary, .btn-secondary').forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // =========================
    // PRELOAD DE RECURSOS CRÍTICOS
    // =========================
    
    // Preload de imágenes críticas
    const criticalImages = [
        'logo.png',
        'Kit tensiometro + fonendoscopio.webp'
    ];
    
    criticalImages.forEach(src => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
    });

    // =========================
    // ERROR HANDLING
    // =========================
    
    // Manejo de errores de carga de imágenes
    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', function() {
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgdmlld0JveD0iMCAwIDIwMCAxNTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik03NSA2MEgxMjVWMTAwSDc1VjYwWiIgZmlsbD0iI0NDQyIvPgo8cGF0aCBkPSJNODcuNSA3MEgxMTIuNVY5MEg4Ny41VjcwWiIgZmlsbD0iI0NDQyIvPgo8L3N2Zz4K';
            this.alt = 'Imagen no disponible';
            this.classList.add('error-image');
        });
    });

    // =========================
    // UTILIDADES
    // =========================
    
    // Función para debouncing
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Optimizar scroll events
    let ticking = false;
    function updateOnScroll() {
        if (!ticking) {
            requestAnimationFrame(() => {
                // Header scroll effect
                const header = document.querySelector('header');
                if (header) {
                    if (window.scrollY > 100) {
                        header.classList.add('scrolled');
                    } else {
                        header.classList.remove('scrolled');
                    }
                }
                ticking = false;
            });
            ticking = true;
        }
    }
    
    window.addEventListener('scroll', debounce(updateOnScroll, 100));

    // Scripts cargados exitosamente
});

// =========================
// CSS DINÁMICO PARA EFECTOS
// =========================

const enhancedStyles = `
    .skip-link {
        position: absolute;
        top: -40px;
        left: 0;
        background: var(--brand);
        color: white;
        padding: 8px;
        text-decoration: none;
        z-index: 10000;
        border-radius: 0 0 4px 0;
    }
    
    .skip-link:focus {
        top: 0;
    }
    
    .keyboard-navigation *:focus {
        outline: 3px solid var(--accent);
        outline-offset: 2px;
    }
    
    .loaded {
        animation: fadeIn 0.5s ease-in;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .error-image {
        filter: grayscale(100%);
        opacity: 0.7;
    }
    
    header.scrolled {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(10px);
    }
    
    .search-match {
        animation: highlight 0.5s ease;
    }
    
    @keyframes highlight {
        0% { background-color: rgba(37, 211, 102, 0.2); }
        100% { background-color: transparent; }
    }
`;

// Agregar estilos dinámicamente
const styleSheet = document.createElement('style');
styleSheet.textContent = enhancedStyles;
document.head.appendChild(styleSheet);
