/**
 * Google Analytics 4 Tracker para Domédicos del Norte
 * Seguimiento avanzado de conversiones y comportamiento del usuario
 */

class AnalyticsTracker {
    constructor() {
        this.measurementId = 'GA_MEASUREMENT_ID'; // Reemplazar con ID real
        this.isInitialized = false;
        this.conversionValue = 0;
        this.init();
    }

    init() {
        // Esperar a que el DOM esté cargado
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupAnalytics());
        } else {
            this.setupAnalytics();
        }
    }

    setupAnalytics() {
        // Verificar si gtag ya está cargado
        if (typeof gtag !== 'undefined') {
            this.isInitialized = true;
            this.setupEventTracking();
            this.setupConversionTracking();
            this.setupPageTracking();
            this.setupUserBehaviorTracking();
            console.log('📊 Analytics 4 inicializado correctamente');
        } else {
            console.warn('⚠️ Google Analytics 4 no está configurado. Agrega el script GA4 en el head.');
        }
    }

    setupEventTracking() {
        // Clicks en botones de cotización
        document.querySelectorAll('.btn-cotizar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const article = e.target.closest('.article');
                const productName = article ? article.querySelector('.article-title').textContent : 'Producto desconocido';
                const category = this.getProductCategory(article);
                
                this.trackEvent('cotizacion_click', {
                    'product_name': productName,
                    'category': category,
                    'page_location': window.location.href,
                    'page_title': document.title
                });
            });
        });

        // Clicks en WhatsApp
        document.querySelectorAll('a[href*="wa.me"]').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = e.target.href;
                const message = href.includes('?text=') ? decodeURIComponent(href.split('?text=')[1]) : '';
                
                this.trackEvent('whatsapp_click', {
                    'phone': '573106107017',
                    'message_length': message.length,
                    'page_location': window.location.href,
                    'page_title': document.title
                });
            });
        });

        // Clicks en enlaces de contacto
        document.querySelectorAll('a[href*="contacto"]').forEach(link => {
            link.addEventListener('click', (e) => {
                this.trackEvent('contact_click', {
                    'destination': 'contacto.html',
                    'page_location': window.location.href,
                    'page_title': document.title
                });
            });
        });

        // Descargas de archivos
        document.querySelectorAll('a[href$=".pdf"], a[href$=".doc"], a[href$=".docx"]').forEach(link => {
            link.addEventListener('click', (e) => {
                const fileName = e.target.href.split('/').pop();
                this.trackEvent('file_download', {
                    'file_name': fileName,
                    'file_extension': fileName.split('.').pop(),
                    'page_location': window.location.href
                });
            });
        });
    }

    setupConversionTracking() {
        // Seguimiento de formularios
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', (e) => {
                const formName = e.target.name || e.target.id || 'formulario_sin_nombre';
                this.trackEvent('form_submit', {
                    'form_name': formName,
                    'page_location': window.location.href,
                    'page_title': document.title
                });
            });
        });

        // Tiempo en página
        this.startTime = Date.now();
        window.addEventListener('beforeunload', () => {
            const timeOnPage = Math.round((Date.now() - this.startTime) / 1000);
            this.trackEvent('page_engagement', {
                'time_on_page_seconds': timeOnPage,
                'page_location': window.location.href,
                'page_title': document.title
            });
        });
    }

    setupPageTracking() {
        // Scroll depth tracking
        let maxScroll = 0;
        let scrollMilestones = [25, 50, 75, 90];
        let reachedMilestones = [];

        window.addEventListener('scroll', () => {
            const scrollPercent = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
            
            if (scrollPercent > maxScroll) {
                maxScroll = scrollPercent;
                
                scrollMilestones.forEach(milestone => {
                    if (scrollPercent >= milestone && !reachedMilestones.includes(milestone)) {
                        reachedMilestones.push(milestone);
                        this.trackEvent('scroll_depth', {
                            'percentage': milestone,
                            'page_location': window.location.href,
                            'page_title': document.title
                        });
                    }
                });
            }
        });
    }

    setupUserBehaviorTracking() {
        // Seguimiento de búsqueda interna
        const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="buscar" i], input[placeholder*="search" i]');
        searchInputs.forEach(input => {
            let searchTimeout;
            input.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    if (e.target.value.length >= 3) {
                        this.trackEvent('internal_search', {
                            'search_term': e.target.value.toLowerCase(),
                            'page_location': window.location.href
                        });
                    }
                }, 1000);
            });
        });

        // Interacciones con productos
        document.querySelectorAll('.article').forEach(article => {
            let viewTime = 0;
            let viewStartTime = null;
            let isVisible = false;

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        if (!isVisible) {
                            isVisible = true;
                            viewStartTime = Date.now();
                            const productName = article.querySelector('.article-title').textContent;
                            this.trackProductView(productName, this.getProductCategory(article));
                        }
                    } else {
                        if (isVisible && viewStartTime) {
                            isVisible = false;
                            viewTime += Date.now() - viewStartTime;
                            viewStartTime = null;
                        }
                    }
                });
            }, { threshold: 0.5 });

            observer.observe(article);
        });
    }

    getProductCategory(article) {
        if (!article) return 'general';
        
        const pageCategory = document.body.className || 'general';
        const breadcrumb = document.querySelector('.breadcrumb');
        
        if (breadcrumb) {
            const breadcrumbText = breadcrumb.textContent;
            if (breadcrumbText.includes('Diagnóstico')) return 'equipos_diagnostico';
            if (breadcrumbText.includes('Movilidad')) return 'movilidad';
            if (breadcrumbText.includes('Hospitalario')) return 'equipos_hospitalarios';
            if (breadcrumbText.includes('Insumos')) return 'insumos_medicos';
            if (breadcrumbText.includes('Repuestos')) return 'repuestos';
            if (breadcrumbText.includes('Especializados')) return 'equipos_especializados';
        }
        
        return pageCategory;
    }

    trackEvent(eventName, parameters = {}) {
        if (!this.isInitialized) return;
        
        try {
            gtag('event', eventName, {
                ...parameters,
                'custom_parameter_1': 'domedicos_del_norte',
                'timestamp': new Date().toISOString()
            });
            
            console.log(`📊 Evento GA4: ${eventName}`, parameters);
        } catch (error) {
            console.error('❌ Error tracking event:', error);
        }
    }

    trackProductView(productName, category) {
        this.trackEvent('view_item', {
            'item_name': productName,
            'item_category': category,
            'currency': 'COP',
            'page_location': window.location.href
        });
    }

    trackLeadGeneration(source, value = 0) {
        this.conversionValue += value;
        
        this.trackEvent('generate_lead', {
            'lead_source': source,
            'value': value,
            'currency': 'COP',
            'page_location': window.location.href
        });
    }

    trackWhatsAppConversion(productName, phone) {
        this.trackEvent('conversion', {
            'transaction_id': Date.now().toString(),
            'value': 1.0,
            'currency': 'COP',
            'product_name': productName,
            'phone': phone,
            'conversion_source': 'whatsapp'
        });
    }

    trackPageView(pageTitle, pageLocation) {
        if (!this.isInitialized) return;
        
        try {
            gtag('config', this.measurementId, {
                'page_title': pageTitle,
                'page_location': pageLocation
            });
        } catch (error) {
            console.error('❌ Error tracking page view:', error);
        }
    }

    // Método para configurar el Measurement ID dinámicamente
    setMeasurementId(id) {
        this.measurementId = id;
        if (typeof gtag !== 'undefined') {
            this.isInitialized = true;
            this.setupEventTracking();
            this.setupConversionTracking();
            this.setupPageTracking();
            this.setupUserBehaviorTracking();
        }
    }

    // Método para obtener estadísticas básicas
    getStats() {
        return {
            'conversions_tracked': this.conversionValue,
            'events_tracked': this.eventCount || 0,
            'is_initialized': this.isInitialized,
            'measurement_id': this.measurementId
        };
    }
}

// Inicializar tracker
const analyticsTracker = new AnalyticsTracker();

// Hacer disponible globalmente
window.analyticsTracker = analyticsTracker;

// Exportar para uso en otros scripts
window.AnalyticsTracker = AnalyticsTracker;
