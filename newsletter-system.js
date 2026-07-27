/**
 * Sistema de Newsletters y Email Marketing
 * Domédicos del Norte
 */

class NewsletterSystem {
    constructor() {
        this.subscribers = this.loadSubscribers();
        this.init();
    }

    init() {
        this.createSubscriptionForm();
        this.loadSubscribersCount();
    }

    /**
     * Cargar suscriptores desde localStorage
     */
    loadSubscribers() {
        const stored = localStorage.getItem('domedicos_newsletter_subscribers');
        return stored ? JSON.parse(stored) : [];
    }

    /**
     * Guardar suscriptores en localStorage
     */
    saveSubscribers() {
        localStorage.setItem('domedicos_newsletter_subscribers', JSON.stringify(this.subscribers));
        this.loadSubscribersCount();
    }

    /**
     * Crear formulario de suscripción
     */
    createSubscriptionForm() {
        // Verificar si ya existe el formulario
        if (document.getElementById('newsletter-form')) return;

        const formHTML = `
            <div id="newsletter-section" class="newsletter-section">
                <div class="container">
                    <div class="newsletter-content">
                        <div class="newsletter-text">
                            <h2 class="newsletter-title">📧 Suscríbete a nuestro Newsletter</h2>
                            <p class="newsletter-description">
                                Recibe ofertas exclusivas, novedades de equipos médicos y tips de mantenimiento.
                                ¡Obtén un 5% de descuento en tu primera compra!
                            </p>
                            <ul class="newsletter-benefits">
                                <li>✅ Ofertas exclusivas para suscriptores</li>
                                <li>✅ Novedades de equipos médicos</li>
                                <li>✅ Tips de mantenimiento</li>
                                <li>✅ 5% de descuento en primera compra</li>
                            </ul>
                        </div>
                        <div class="newsletter-form-container">
                            <form id="newsletter-form" class="newsletter-form" action="https://formspree.io/f/mdaqyjwv" method="POST">
                                <input type="hidden" name="_subject" value="New Newsletter Subscription - Domédicos del Norte">
                                <input type="hidden" name="_captcha" value="false">
                                <div class="form-group">
                                    <label for="newsletter-name">Nombre</label>
                                    <input type="text" id="newsletter-name" name="name" required
                                           placeholder="Tu nombre" class="form-input">
                                </div>
                                <div class="form-group">
                                    <label for="newsletter-email">Correo Electrónico</label>
                                    <input type="email" id="newsletter-email" name="email" required
                                           placeholder="tu@correo.com" class="form-input">
                                </div>
                                <div class="form-group">
                                    <label for="newsletter-interest">Intereses</label>
                                    <select id="newsletter-interest" name="interest" class="form-select">
                                        <option value="general">Intereses Generales</option>
                                        <option value="diagnostico">Equipos de Diagnóstico</option>
                                        <option value="movilidad">Movilidad y Ortopedia</option>
                                        <option value="insumos">Insumos Médicos</option>
                                        <option value="especializados">Equipos Especializados</option>
                                    </select>
                                </div>
                                <div class="form-group checkbox-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="newsletter-privacy" required>
                                        <span>Acepto la política de privacidad y el tratamiento de mis datos</span>
                                    </label>
                                </div>
                                <button type="submit" class="btn-newsletter">
                                    <span>Suscribirme</span>
                                    <span>📧</span>
                                </button>
                            </form>
                            <div id="newsletter-message" class="newsletter-message"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insertar antes del footer
        const footer = document.querySelector('footer');
        if (footer) {
            footer.insertAdjacentHTML('beforebegin', formHTML);
        }

        // Agregar event listener
        const form = document.getElementById('newsletter-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleSubscription(e));
        }
    }

    /**
     * Manejar suscripción
     */
    async handleSubscription(e) {
        e.preventDefault();
        
        const form = document.getElementById('newsletter-form');
        const name = document.getElementById('newsletter-name').value.trim();
        const email = document.getElementById('newsletter-email').value.trim().toLowerCase();
        const interest = document.getElementById('newsletter-interest').value;
        const privacy = document.getElementById('newsletter-privacy').checked;

        // Validaciones
        if (!name || !email) {
            this.showMessage('Por favor completa todos los campos requeridos', 'error');
            return;
        }

        if (!this.validateEmail(email)) {
            this.showMessage('Por favor ingresa un correo electrónico válido', 'error');
            return;
        }

        if (!privacy) {
            this.showMessage('Debes aceptar la política de privacidad', 'error');
            return;
        }

        // Verificar si ya está suscrito (localStorage check)
        if (this.isSubscribed(email)) {
            this.showMessage('Este correo ya está suscrito a nuestro newsletter', 'warning');
            return;
        }

        // Submit to Formspree
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>Enviando...</span><span>📧</span>';
        submitBtn.disabled = true;

        try {
            console.log('Submitting newsletter to:', form.action);
            const formData = new FormData(form);
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });

            console.log('Newsletter response status:', response.status);
            console.log('Newsletter response ok:', response.ok);
            
            const data = await response.json();
            console.log('Newsletter response data:', data);

            if (response.ok) {
                // Also save to localStorage for local tracking
                const subscriber = {
                    id: Date.now(),
                    name: name,
                    email: email,
                    interest: interest,
                    subscribedAt: new Date().toISOString(),
                    status: 'active'
                };

                this.subscribers.push(subscriber);
                this.saveSubscribers();

                // Mostrar mensaje de éxito
                this.showMessage('¡Gracias por suscribirte! Revisa tu correo para confirmar tu suscripción y recibir tu descuento.', 'success');

                // Limpiar formulario
                form.reset();

                // Enviar evento a Google Analytics
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'newsletter_subscription', {
                        'event_category': 'engagement',
                        'event_label': interest,
                        'value': 1
                    });
                }

                // Enviar notificación por WhatsApp (opcional)
                this.sendWhatsAppNotification(subscriber);
            } else {
                const errorMsg = data.error || 'Hubo un error al suscribirte. Por favor, inténtalo de nuevo.';
                this.showMessage(errorMsg, 'error');
            }
        } catch (error) {
            console.error('Newsletter submission error:', error);
            this.showMessage('Hubo un error de conexión. Por favor, inténtalo de nuevo.', 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    /**
     * Validar formato de email
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Verificar si el email ya está suscrito
     */
    isSubscribed(email) {
        return this.subscribers.some(sub => sub.email === email && sub.status === 'active');
    }

    /**
     * Mostrar mensaje
     */
    showMessage(message, type) {
        const messageDiv = document.getElementById('newsletter-message');
        if (messageDiv) {
            messageDiv.className = `newsletter-message ${type}`;
            messageDiv.innerHTML = `
                <span class="message-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️'}</span>
                <span class="message-text">${message}</span>
            `;
            messageDiv.style.display = 'block';

            // Ocultar después de 5 segundos
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Cargar contador de suscriptores
     */
    loadSubscribersCount() {
        const count = this.subscribers.filter(sub => sub.status === 'active').length;
        const countElement = document.getElementById('subscribers-count');
        if (countElement) {
            countElement.textContent = count;
        }
    }

    /**
     * Enviar notificación por WhatsApp al negocio
     */
    sendWhatsAppNotification(subscriber) {
        const message = `📧 Nueva suscripción al newsletter:
        
👤 Nombre: ${subscriber.name}
📧 Email: ${subscriber.email}
🎯 Interés: ${subscriber.interest}
📅 Fecha: ${new Date().toLocaleDateString('es-CO')}

Total suscriptores: ${this.subscribers.filter(sub => sub.status === 'active').length}`;

        const whatsappUrl = `https://wa.me/573106107017?text=${encodeURIComponent(message)}`;
        
        // Abrir en nueva ventana (opcional, comentado por defecto)
        // window.open(whatsappUrl, '_blank');
    }

    /**
     * Desuscribir email
     */
    unsubscribe(email) {
        const subscriber = this.subscribers.find(sub => sub.email === email);
        if (subscriber) {
            subscriber.status = 'unsubscribed';
            subscriber.unsubscribedAt = new Date().toISOString();
            this.saveSubscribers();
            return true;
        }
        return false;
    }

    /**
     * Exportar suscriptores (para integración con servicios de email marketing)
     */
    exportSubscribers() {
        const activeSubscribers = this.subscribers.filter(sub => sub.status === 'active');
        const csv = [
            ['Nombre', 'Email', 'Interés', 'Fecha de Suscripción'].join(','),
            ...activeSubscribers.map(sub => 
                [sub.name, sub.email, sub.interest, sub.subscribedAt].join(',')
            )
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'domedicos_newsletter_subscribers.csv';
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Obtener estadísticas
     */
    getStats() {
        const active = this.subscribers.filter(sub => sub.status === 'active').length;
        const total = this.subscribers.length;
        const byInterest = {};

        this.subscribers.forEach(sub => {
            if (sub.status === 'active') {
                byInterest[sub.interest] = (byInterest[sub.interest] || 0) + 1;
            }
        });

        return {
            total: total,
            active: active,
            byInterest: byInterest
        };
    }
}

// Inicializar el sistema cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new NewsletterSystem();
    });
} else {
    new NewsletterSystem();
}
