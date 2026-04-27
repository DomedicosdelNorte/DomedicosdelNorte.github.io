/**
 * Banner de Cookies GDPR Compliant
 * Domédicos del Norte - Cumplimiento de Protección de Datos
 */

class CookieBanner {
    constructor() {
        this.consentGiven = false;
        this.consentData = {
            essential: true, // Siempre necesarias
            analytics: false,
            marketing: false,
            preferences: false
        };
        this.init();
    }

    init() {
        // Verificar si ya hay consentimiento
        const existingConsent = localStorage.getItem('domedicos_cookie_consent');
        
        if (!existingConsent) {
            this.showBanner();
        } else {
            this.consentData = JSON.parse(existingConsent);
            this.consentGiven = true;
            this.applyConsent();
        }
    }

    showBanner() {
        // Crear banner de cookies
        const banner = document.createElement('div');
        banner.id = 'cookie-banner';
        banner.innerHTML = `
            <div style="
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                color: white;
                padding: 20px;
                z-index: 10000;
                box-shadow: 0 -4px 6px rgba(0,0,0,0.1);
                font-family: Arial, sans-serif;
                border-top: 3px solid #3498db;
            ">
                <div style="max-width: 1200px; margin: 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 20px;">
                    <div style="flex: 1; min-width: 300px;">
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                            <span style="font-size: 24px; margin-right: 10px;">🍪</span>
                            <h4 style="margin: 0; font-size: 16px; font-weight: 600;">Usamos Cookies</h4>
                        </div>
                        <p style="margin: 0; font-size: 14px; line-height: 1.4; opacity: 0.9;">
                            Utilizamos cookies esenciales para el funcionamiento del sitio y cookies opcionales 
                            para mejorar tu experiencia. Al aceptar, ayudas a cumplir con el GDPR y proteges tu privacidad.
                        </p>
                        <button onclick="window.cookieBanner.showDetails()" style="
                            background: none;
                            border: none;
                            color: #3498db;
                            text-decoration: underline;
                            font-size: 12px;
                            cursor: pointer;
                            padding: 0;
                            margin-top: 5px;
                        ">Ver detalles y personalizar</button>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button onclick="window.cookieBanner.rejectAll()" style="
                            background: rgba(255,255,255,0.1);
                            color: white;
                            border: 1px solid rgba(255,255,255,0.3);
                            padding: 8px 16px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 14px;
                        ">Rechazar</button>
                        <button onclick="window.cookieBanner.acceptAll()" style="
                            background: #3498db;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                        ">Aceptar Todas</button>
                    </div>
                </div>
            </div>
        `;

        // Crear modal de detalles
        const modal = document.createElement('div');
        modal.id = 'cookie-modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            ">
                <div style="
                    background: white;
                    color: #333;
                    border-radius: 10px;
                    max-width: 600px;
                    width: 100%;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                ">
                    <div style="
                        background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 10px 10px 0 0;
                    ">
                        <h3 style="margin: 0; font-size: 20px; display: flex; align-items: center;">
                            <span style="font-size: 28px; margin-right: 10px;">🍪</span>
                            Configuración de Cookies
                        </h3>
                        <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">
                            Controla cómo usamos tus datos según el GDPR y Ley 1581 de 2012
                        </p>
                    </div>
                    
                    <div style="padding: 20px;">
                        <div style="margin-bottom: 20px;">
                            <h4 style="color: #2c3e50; margin: 0 0 10px 0;">📋 Tipos de Cookies</h4>
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <div>
                                        <strong style="color: #2c3e50;">Cookies Esenciales</strong>
                                        <p style="margin: 5px 0; font-size: 12px; color: #666;">
                                            Necesarias para el funcionamiento básico del sitio
                                        </p>
                                    </div>
                                    <div style="color: #27ae60; font-weight: bold;">SIEMPRE ACTIVAS</div>
                                </div>
                            </div>
                            
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong style="color: #2c3e50;">Cookies de Análisis</strong>
                                        <p style="margin: 5px 0; font-size: 12px; color: #666;">
                                            Nos ayudan a entender cómo usas el sitio
                                        </p>
                                    </div>
                                    <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                        <input type="checkbox" id="analytics-cookies" style="opacity: 0; width: 0; height: 0;">
                                        <span style="
                                            position: absolute;
                                            cursor: pointer;
                                            top: 0;
                                            left: 0;
                                            right: 0;
                                            bottom: 0;
                                            background-color: #ccc;
                                            transition: .4s;
                                            border-radius: 24px;
                                        "></span>
                                        <span style="
                                            position: absolute;
                                            content: "";
                                            height: 18px;
                                            width: 18px;
                                            left: 3px;
                                            bottom: 3px;
                                            background-color: white;
                                            transition: .4s;
                                            border-radius: 50%;
                                        "></span>
                                    </label>
                                </div>
                            </div>
                            
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <strong style="color: #2c3e50;">Cookies de Marketing</strong>
                                        <p style="margin: 5px 0; font-size: 12px; color: #666;">
                                            Para personalización y publicidad relevante
                                        </p>
                                    </div>
                                    <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
                                        <input type="checkbox" id="marketing-cookies" style="opacity: 0; width: 0; height: 0;">
                                        <span style="
                                            position: absolute;
                                            cursor: pointer;
                                            top: 0;
                                            left: 0;
                                            right: 0;
                                            bottom: 0;
                                            background-color: #ccc;
                                            transition: .4s;
                                            border-radius: 24px;
                                        "></span>
                                        <span style="
                                            position: absolute;
                                            content: "";
                                            height: 18px;
                                            width: 18px;
                                            left: 3px;
                                            bottom: 3px;
                                            background-color: white;
                                            transition: .4s;
                                            border-radius: 50%;
                                        "></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                            <h4 style="color: #2c3e50; margin: 0 0 10px 0;">🔒 Tu Privacidad</h4>
                            <p style="margin: 0; font-size: 13px; line-height: 1.4;">
                                Respetamos tu privacidad según el GDPR (UE) y la Ley 1581 de 2012 (Colombia). 
                                Puedes cambiar tus preferencias en cualquier momento. 
                                <a href="politica-privacidad.html" style="color: #3498db; text-decoration: none;">Ver política completa</a>
                            </p>
                        </div>
                        
                        <div style="display: flex; gap: 10px; justify-content: flex-end;">
                            <button onclick="window.cookieBanner.closeModal()" style="
                                background: #95a5a6;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 5px;
                                cursor: pointer;
                                font-size: 14px;
                            ">Cancelar</button>
                            <button onclick="window.cookieBanner.savePreferences()" style="
                                background: #27ae60;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 5px;
                                cursor: pointer;
                                font-size: 14px;
                                font-weight: 600;
                            ">Guardar Preferencias</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(banner);
        document.body.appendChild(modal);

        // Configurar switches
        this.setupSwitches();
    }

    setupSwitches() {
        const setupSwitch = (inputId) => {
            const input = document.getElementById(inputId);
            if (input) {
                const span = input.nextElementSibling;
                const afterSpan = span.nextElementSibling;
                
                input.addEventListener('change', function() {
                    if (this.checked) {
                        span.style.backgroundColor = '#3498db';
                        afterSpan.style.transform = 'translateX(26px)';
                    } else {
                        span.style.backgroundColor = '#ccc';
                        afterSpan.style.transform = 'translateX(0)';
                    }
                });
                
                // Estado inicial
                if (this.checked) {
                    span.style.backgroundColor = '#3498db';
                    afterSpan.style.transform = 'translateX(26px)';
                }
            }
        };

        setupSwitch('analytics-cookies');
        setupSwitch('marketing-cookies');
    }

    showDetails() {
        document.getElementById('cookie-modal').style.display = 'flex';
    }

    closeModal() {
        document.getElementById('cookie-modal').style.display = 'none';
    }

    acceptAll() {
        this.consentData = {
            essential: true,
            analytics: true,
            marketing: true,
            preferences: true
        };
        this.saveConsent();
        this.hideBanner();
    }

    rejectAll() {
        this.consentData = {
            essential: true,
            analytics: false,
            marketing: false,
            preferences: false
        };
        this.saveConsent();
        this.hideBanner();
    }

    savePreferences() {
        this.consentData = {
            essential: true,
            analytics: document.getElementById('analytics-cookies').checked,
            marketing: document.getElementById('marketing-cookies').checked,
            preferences: true
        };
        this.saveConsent();
        this.closeModal();
        this.hideBanner();
    }

    saveConsent() {
        localStorage.setItem('domedicos_cookie_consent', JSON.stringify(this.consentData));
        localStorage.setItem('domedicos_cookie_timestamp', Date.now().toString());
        this.consentGiven = true;
        this.applyConsent();
        
        // Registrar consentimiento para cumplimiento GDPR
        this.logConsent();
    }

    logConsent() {
        // Registrar consentimiento para auditorías GDPR
        const consentLog = {
            timestamp: new Date().toISOString(),
            consent: this.consentData,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        // Guardar log de consentimiento
        const existingLogs = JSON.parse(localStorage.getItem('domedicos_consent_logs') || '[]');
        existingLogs.push(consentLog);
        
        // Mantener solo últimos 30 logs
        if (existingLogs.length > 30) {
            existingLogs.shift();
        }
        
        localStorage.setItem('domedicos_consent_logs', JSON.stringify(existingLogs));
        
        console.log('🍪 Consentimiento de cookies registrado:', consentLog);
    }

    applyConsent() {
        // Aplicar configuración de cookies
        if (this.consentData.analytics) {
            console.log('📊 Cookies de análisis activadas');
            // Aquí se activaría Google Analytics, etc.
        }
        
        if (this.consentData.marketing) {
            console.log('📢 Cookies de marketing activadas');
            // Aquí se activaría marketing/pixel, etc.
        }
        
        // Cookies esenciales siempre activas
        console.log('🔒 Cookies esenciales siempre activas');
    }

    hideBanner() {
        const banner = document.getElementById('cookie-banner');
        if (banner) {
            banner.style.opacity = '0';
            banner.style.transform = 'translateY(100%)';
            setTimeout(() => banner.remove(), 300);
        }
    }

    // Método público para cambiar preferencias
    changePreferences() {
        this.showDetails();
    }
}

// Inicializar banner de cookies
let cookieBanner;

document.addEventListener('DOMContentLoaded', () => {
    cookieBanner = new CookieBanner();
    
    // Hacer disponible globalmente
    window.cookieBanner = cookieBanner;
});

// Exportar para uso global
window.CookieBanner = CookieBanner;
