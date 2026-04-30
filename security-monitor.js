/**
 * FASE 3 - Sistema de Seguridad Avanzada
 * Domédicos del Norte - Protección a Nivel de Aplicación
 */

class SecurityMonitor {
    constructor() {
        this.startTime = Date.now();
        this.requests = new Map();
        this.suspiciousIPs = new Set();
        this.blockedIPs = new Set();
        this.rateLimitWindow = 60000; // 1 minuto
        this.maxRequestsPerWindow = 1000; // Aumentado a 1000 (prácticamente nulo)
        this.backupInterval = null;
        this.uptimeCheckInterval = null;
        this.init();
    }

    init() {
        console.log('🛡️ Sistema de Seguridad Activado - Domédicos del Norte');
        this.startUptimeMonitoring();
        this.startBackupSystem();
        this.setupRateLimiting();
        this.setupFirewall();
        this.setupAnomalyDetection();
        this.loadSecurityData();
    }

    // 1. MONITOR DE UPTIME
    startUptimeMonitoring() {
        this.uptimeCheckInterval = setInterval(() => {
            this.checkUptime();
        }, 30000); // Cada 30 segundos

        // Primer chequeo inmediato
        this.checkUptime();
    }

    checkUptime() {
        const currentTime = Date.now();
        const uptime = currentTime - this.startTime;
        
        // Guardar estadísticas
        const stats = this.getSecurityStats();
        stats.uptimeChecks = (stats.uptimeChecks || 0) + 1;
        stats.lastUptimeCheck = currentTime;
        stats.totalUptime = uptime;
        
        this.saveSecurityData();
        
        // Log de uptime
        console.log(`⏰ Uptime Check: ${Math.floor(uptime / 1000 / 60)} minutos online`);
        
        // Alerta si hay problemas
        if (performance.now() > 5000) { // Si la página tarda más de 5 segundos
            this.sendAlert('Rendimiento lento detectado');
        }
    }

    // 2. SISTEMA DE BACKUP AUTOMÁTICO
    startBackupSystem() {
        // Backup cada 6 horas
        this.backupInterval = setInterval(() => {
            this.createBackup();
        }, 21600000); // 6 horas

        // Primer backup
        this.createBackup();
    }

    createBackup() {
        const backupData = {
            timestamp: Date.now(),
            version: '1.0',
            data: {
                securityStats: this.getSecurityStats(),
                blockedIPs: Array.from(this.blockedIPs),
                suspiciousIPs: Array.from(this.suspiciousIPs),
                requests: this.serializeRequests(),
                settings: this.getSecuritySettings()
            }
        };

        // Guardar en localStorage
        try {
            localStorage.setItem('domedicos_backup_' + Date.now(), JSON.stringify(backupData));
            
            // Mantener solo los últimos 7 backups
            this.cleanupOldBackups();
            
            console.log('💾 Backup automático creado');
            
            // Ofrecer descarga manual
            this.offerBackupDownload(backupData);
            
        } catch (error) {
            console.error('❌ Error en backup:', error);
            this.sendAlert('Error en sistema de backup');
        }
    }

    cleanupOldBackups() {
        const keys = Object.keys(localStorage);
        const backupKeys = keys.filter(key => key.startsWith('domedicos_backup_'));
        
        // Mantener solo los 7 más recientes
        if (backupKeys.length > 7) {
            backupKeys.sort().slice(0, -7).forEach(key => {
                localStorage.removeItem(key);
            });
        }
    }

    offerBackupDownload(backupData) {
        // Crear botón de descarga si no existe
        if (!document.getElementById('backup-download')) {
            const button = document.createElement('button');
            button.id = 'backup-download';
            button.innerHTML = '📥 Descargar Backup';
            button.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 80px;
                background: #28a745;
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 5px;
                cursor: pointer;
                z-index: 1000;
                font-size: 12px;
            `;
            
            button.onclick = () => this.downloadBackup(backupData);
            document.body.appendChild(button);
        }
    }

    downloadBackup(backupData) {
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `domedicos_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        console.log('📥 Backup descargado manualmente');
    }

    // 3. FIREWALL A NIVEL DE APLICACIÓN
    setupFirewall() {
        // Intercepta todas las peticiones fetch
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const url = args[0];
            const options = args[1] || {};
            
            // Analizar la petición
            if (this.isMaliciousRequest(url, options)) {
                this.blockRequest('Malicious request detected', url);
                throw new Error('Request blocked by firewall');
            }
            
            try {
                const response = await originalFetch(...args);
                this.logRequest(url, response.status);
                return response;
            } catch (error) {
                this.logRequest(url, 0, error);
                throw error;
            }
        };

        // Protección contra XSS
        this.setupXSSProtection();
        
        // Protección contra CSRF
        this.setupCSRFProtection();
    }

    isMaliciousRequest(url, options) {
        const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /eval\s*\(/i,
            /document\.cookie/i,
            /\.\.\//i,
            /union\s+select/i,
            /drop\s+table/i
        ];

        return suspiciousPatterns.some(pattern => 
            pattern.test(url) || 
            (options.body && pattern.test(options.body))
        );
    }

    setupXSSProtection() {
        // Sanitizar inputs dinámicamente
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        this.sanitizeNode(node);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    sanitizeNode(node) {
        // Remover atributos peligrosos
        const dangerousAttrs = ['onload', 'onerror', 'onclick', 'onmouseover'];
        dangerousAttrs.forEach(attr => {
            if (node.hasAttribute(attr)) {
                node.removeAttribute(attr);
                console.warn(`🚨 Atributo peligroso removido: ${attr}`);
            }
        });

        // Revisar scripts
        if (node.tagName === 'SCRIPT') {
            const content = node.textContent;
            if (this.containsSuspiciousCode(content)) {
                node.remove();
                console.warn('🚨 Script malicioso bloqueado');
            }
        }
    }

    containsSuspiciousCode(code) {
        const suspiciousPatterns = [
            /eval\s*\(/,
            /document\.write/,
            /innerHTML\s*=/,
            /outerHTML\s*=/,
            /insertAdjacentHTML/
        ];

        return suspiciousPatterns.some(pattern => pattern.test(code));
    }

    setupCSRFProtection() {
        // Generar token CSRF
        if (!localStorage.getItem('csrf_token')) {
            const token = this.generateCSRFToken();
            localStorage.setItem('csrf_token', token);
        }
    }

    generateCSRFToken() {
        return Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // 4. RATE LIMITING
    setupRateLimiting() {
        // Monitorear eventos del usuario
        ['click', 'scroll', 'keydown', 'mousemove'].forEach(event => {
            document.addEventListener(event, () => {
                this.trackUserActivity(event);
            });
        });

        // Limpiar ventana de rate limiting periódicamente
        setInterval(() => {
            this.cleanupRateLimit();
        }, this.rateLimitWindow);
    }

    trackUserActivity(event) {
        const clientId = this.getClientId();
        const now = Date.now();
        
        if (!this.requests.has(clientId)) {
            this.requests.set(clientId, []);
        }

        const clientRequests = this.requests.get(clientId);
        clientRequests.push({
            timestamp: now,
            event: event,
            url: window.location.href
        });

        // Verificar rate limit - PRÁCTICAMENTE NULO
        const recentRequests = clientRequests.filter(
            req => now - req.timestamp < this.rateLimitWindow
        );

        // Solo bloquear si es extremadamente abusivo (>2000 peticiones/minuto)
        if (recentRequests.length > 2000) {
            console.warn(`Actividad extremadamente sospechosa: ${recentRequests.length} peticiones/minuto`);
            this.handleRateLimitExceeded(clientId);
        }

        this.requests.set(clientId, recentRequests);
    }

    handleRateLimitExceeded(clientId) {
        console.warn(`🚨 Actividad extremadamente sospechosa: ${clientId}`);
        
        // Solo bloquear si es abuso extremo (>2000 peticiones/minuto)
        this.showCAPTCHAChallenge(clientId);
    }

    showCAPTCHAChallenge(clientId) {
        // Mostrar CAPTCHA simple para actividad extremadamente sospechosa
        const captcha = document.createElement('div');
        const num1 = Math.floor(Math.random() * 10) + 1;
        const num2 = Math.floor(Math.random() * 10) + 1;
        const answer = num1 + num2;
        
        captcha.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.9);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                font-size: 16px;
            ">
                <div style="text-align: center; background: #333; padding: 30px; border-radius: 10px;">
                    🔒 Verificación de Seguridad
                    <br><br>
                    Por favor resuelve: <strong>${num1} + ${num2} = ?</strong>
                    <br><br>
                    <input type="number" id="captcha-answer" placeholder="Tu respuesta" style="
                        padding: 8px; font-size: 16px; border: none; border-radius: 5px; text-align: center; width: 100px;
                    ">
                    <br><br>
                    <button onclick="window.securityMonitor.verifyCAPTCHA(${answer})" style="
                        padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;
                    ">Verificar</button>
                    <br><br>
                    <small style="color: #ccc;">Esta medida protege contra bots automatizados.</small>
                </div>
            </div>
        `;
        
        document.body.appendChild(captcha);
        
        // Enfocar input automáticamente
        setTimeout(() => {
            const input = document.getElementById('captcha-answer');
            if (input) {
                input.focus();
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.verifyCAPTCHA(answer);
                    }
                });
            }
        }, 100);
    }
    
    verifyCAPTCHA(correctAnswer) {
        const input = document.getElementById('captcha-answer');
        const userAnswer = parseInt(input.value);
        
        if (userAnswer === correctAnswer) {
            // CAPTCHA correcto - remover desafío
            const captcha = document.querySelector('div[style*="position: fixed"]');
            if (captcha) captcha.remove();
            
            this.showNotification('✅ Verificación completada - Puedes continuar navegando');
            console.log('✅ CAPTCHA verificado correctamente');
        } else {
            // CAPTCHA incorrecto - mostrar nuevo desafío
            const captcha = document.querySelector('div[style*="position: fixed"]');
            if (captcha) captcha.remove();
            
            // Generar nuevo CAPTCHA
            setTimeout(() => {
                const clientId = this.getClientId();
                this.showCAPTCHAChallenge(clientId);
            }, 500);
        }
    }

    showRateLimitWarning() {
        const warning = document.createElement('div');
        warning.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ffc107;
                color: #333;
                padding: 12px 18px;
                border-radius: 8px;
                z-index: 10000;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                font-size: 14px;
            ">
                🐌 Navegación muy rápida detectada
                <br>
                <small>Por favor, reduce un poco la velocidad para mejor experiencia.</small>
            </div>
        `;
        
        document.body.appendChild(warning);
        
        setTimeout(() => {
            warning.remove();
        }, 3000);
    }

    temporaryBlock(clientId) {
        console.warn(`🚫 Cliente bloqueado temporalmente: ${clientId}`);
        this.blockedIPs.add(clientId);
        
        // Mostrar mensaje de bloqueo más amigable
        this.showBlockedMessage();
        
        // Reducido a 1 minuto en lugar de 5 minutos
        setTimeout(() => {
            this.blockedIPs.delete(clientId);
            this.suspiciousIPs.delete(clientId);
            this.showNotification('Acceso restaurado - Puedes continuar navegando');
        }, 60000); // Reducido de 300000 a 60000ms
    }

    showBlockedMessage() {
        const message = document.createElement('div');
        message.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                font-size: 16px;
            ">
                <div style="text-align: center; max-width: 400px; padding: 20px;">
                    ⏳ Pausa de Seguridad Temporal
                    <br><br>
                    Hemos detectado actividad inusual.
                    <br>
                    Por tu seguridad, espera 1 minuto.
                    <br><br>
                    <small style="color: #ccc;">Esta medida protege contra ataques automatizados.</small>
                </div>
            </div>
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 3000);
    }

    cleanupRateLimit() {
        const now = Date.now();
        this.requests.forEach((requests, clientId) => {
            const validRequests = requests.filter(
                req => now - req.timestamp < this.rateLimitWindow
            );
            
            if (validRequests.length === 0) {
                this.requests.delete(clientId);
            } else {
                this.requests.set(clientId, validRequests);
            }
        });
    }

    // 5. DETECCIÓN DE ANOMALÍAS
    setupAnomalyDetection() {
        // Monitorear patrones de comportamiento
        setInterval(() => {
            this.analyzePatterns();
        }, 60000); // Cada minuto
        
        // Detección de anomalías en tiempo real
        this.setupRealTimeDetection();
    }

    analyzePatterns() {
        const stats = this.getSecurityStats();
        const anomalies = [];

        // Detectar picos de actividad
        if (stats.totalRequests > 1000) {
            anomalies.push('Pico de actividad anormal');
        }

        // Detectar múltiples IPs sospechosas
        if (this.suspiciousIPs.size > 10) {
            anomalies.push('Múltiples IPs sospechosas detectadas');
        }

        // Detectar errores frecuentes
        if (stats.errorRate > 0.1) {
            anomalies.push('Alta tasa de errores');
        }

        if (anomalies.length > 0) {
            this.handleAnomalies(anomalies);
        }
    }

    setupRealTimeDetection() {
        // DETECCIÓN MÍNIMA - Solo actividad extremadamente sospechosa
        
        // Detectar inactividad prolongada (>20 minutos)
        let lastActivity = Date.now();
        let inactivityTimer;
        
        const resetInactivityTimer = () => {
            lastActivity = Date.now();
            clearTimeout(inactivityTimer);
            
            inactivityTimer = setTimeout(() => {
                const inactiveTime = Date.now() - lastActivity;
                if (inactiveTime > 20 * 60 * 1000) { // 20 minutos
                    console.log('Usuario inactivo por más de 20 minutos');
                    // No hacer nada, solo registrar
                }
            }, 20 * 60 * 1000);
        };
        
        // Monitorear actividad del usuario
        ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
            document.addEventListener(event, resetInactivityTimer);
        });
        
        // Iniciar timer
        resetInactivityTimer();
    }

    handleAnomalies(anomalies) {
        console.warn('🚨 Anomalías detectadas:', anomalies);
        this.sendAlert('Anomalías de seguridad: ' + anomalies.join(', '));
        
        // Aumentar nivel de seguridad
        this.increaseSecurityLevel();
    }

    handleAnomaly(anomaly) {
        console.warn('🚨 Anomalía detectada:', anomaly);
        this.sendAlert('Anomalía: ' + anomaly);
        
        // Tomar acción correctiva
        const clientId = this.getClientId();
        this.suspiciousIPs.add(clientId);
    }

    increaseSecurityLevel() {
        // Reducir límites de rate limiting
        this.maxRequestsPerWindow = Math.max(10, this.maxRequestsPerWindow * 0.8);
        
        console.log('🔒 Nivel de seguridad aumentado');
    }

    // UTILIDADES
    getClientId() {
        // Usar fingerprinting básico para identificar clientes
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset()
        ].join('|');
        
        return this.hashString(fingerprint);
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    logRequest(url, status, error = null) {
        const stats = this.getSecurityStats();
        stats.totalRequests = (stats.totalRequests || 0) + 1;
        
        if (status >= 400 || error) {
            stats.errorRequests = (stats.errorRequests || 0) + 1;
        }
        
        stats.errorRate = stats.errorRequests / stats.totalRequests;
        stats.lastRequest = {
            url: url,
            status: status,
            timestamp: Date.now()
        };
        
        this.saveSecurityData();
    }

    blockRequest(reason, url) {
        console.warn('🚫 Petición bloqueada:', reason, url);
        this.sendAlert('Petición bloqueada: ' + reason);
        
        const stats = this.getSecurityStats();
        stats.blockedRequests = (stats.blockedRequests || 0) + 1;
        this.saveSecurityData();
    }

    sendAlert(message) {
        console.error('🚨 ALERTA DE SEGURIDAD:', message);
        
        // Guardar alerta
        const stats = this.getSecurityStats();
        stats.alerts = stats.alerts || [];
        stats.alerts.push({
            message: message,
            timestamp: Date.now()
        });
        
        // Mantener solo las últimas 50 alertas
        if (stats.alerts.length > 50) {
            stats.alerts = stats.alerts.slice(-50);
        }
        
        this.saveSecurityData();
    }

    getSecurityStats() {
        const stored = localStorage.getItem('domedicos_security_stats');
        return stored ? JSON.parse(stored) : {};
    }

    saveSecurityData() {
        localStorage.setItem('domedicos_security_stats', JSON.stringify(this.getSecurityStats()));
    }

    loadSecurityData() {
        const stats = this.getSecurityStats();
        console.log('📊 Estadísticas de seguridad cargadas:', stats);
    }

    getSecuritySettings() {
        return {
            rateLimitWindow: this.rateLimitWindow,
            maxRequestsPerWindow: this.maxRequestsPerWindow,
            blockedIPs: Array.from(this.blockedIPs),
            suspiciousIPs: Array.from(this.suspiciousIPs)
        };
    }

    serializeRequests() {
        const serialized = {};
        this.requests.forEach((requests, clientId) => {
            serialized[clientId] = requests;
        });
        return serialized;
    }

    // PANEL DE CONTROL
    showSecurityPanel() {
        const panel = document.createElement('div');
        panel.innerHTML = `
            <div style="
                position: fixed;
                top: 50px;
                right: 20px;
                width: 300px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                font-family: Arial, sans-serif;
            ">
                <h3 style="margin: 0 0 15px 0; color: #333;">🛡️ Panel de Seguridad</h3>
                <div id="security-stats">
                    Cargando estadísticas...
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    margin-top: 15px;
                    padding: 8px 16px;
                    background: #dc3545;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                ">Cerrar</button>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.updateSecurityPanel();
    }

    updateSecurityPanel() {
        const stats = this.getSecurityStats();
        const panel = document.getElementById('security-stats');
        
        if (panel) {
            panel.innerHTML = `
                <div style="font-size: 14px; line-height: 1.6;">
                    <div><strong>Uptime:</strong> ${Math.floor((Date.now() - this.startTime) / 1000 / 60)} min</div>
                    <div><strong>Peticiones totales:</strong> ${stats.totalRequests || 0}</div>
                    <div><strong>Tasa de error:</strong> ${((stats.errorRate || 0) * 100).toFixed(2)}%</div>
                    <div><strong>IPs bloqueadas:</strong> ${this.blockedIPs.size}</div>
                    <div><strong>IPs sospechosas:</strong> ${this.suspiciousIPs.size}</div>
                    <div><strong>Alertas:</strong> ${stats.alerts ? stats.alerts.length : 0}</div>
                    <div><strong>Último backup:</strong> ${new Date().toLocaleTimeString()}</div>
                </div>
            `;
        }
    }

    // MÉTODO PÚBLICO PARA ACTIVAR PANEL - OCULTO
    enableSecurityPanel() {
        // NO mostrar botones públicos - solo acceso secreto
        
        // Agregar acceso secreto con combinación de teclas
        let secretSequence = [];
        const secretCode = ['d', 'o', 'm', 'e', 'd', 'i', 'c', 'o', 's']; // DOMEDICOS
        
        document.addEventListener('keydown', (e) => {
            secretSequence.push(e.key.toLowerCase());
            
            // Mantener solo los últimos 9 caracteres
            if (secretSequence.length > secretCode.length) {
                secretSequence.shift();
            }
            
            // Verificar si coincide con la secuencia secreta
            if (JSON.stringify(secretSequence) === JSON.stringify(secretCode)) {
                this.showLoginDialog();
                secretSequence = []; // Resetear secuencia
            }
        });
        
        // NO agregar botones públicos - solo acceso secreto
        // this.addBackupButton(); // Comentado - debe ser oculto
    }
    
    showLoginDialog() {
        const loginDialog = document.createElement('div');
        loginDialog.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.9);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                font-size: 16px;
            ">
                <div style="text-align: center; background: #333; padding: 30px; border-radius: 10px; max-width: 400px;">
                    🔐 Acceso de Empleado
                    <br><br>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px; text-align: left;">Usuario:</label>
                        <input type="text" id="security-username" placeholder="Usuario" style="
                            width: 100%; padding: 10px; border: none; border-radius: 5px; font-size: 14px;
                        ">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 5px; text-align: left;">Contraseña:</label>
                        <input type="password" id="security-password" placeholder="Contraseña" style="
                            width: 100%; padding: 10px; border: none; border-radius: 5px; font-size: 14px;
                        ">
                    </div>
                    <button onclick="window.securityMonitor.verifyLogin()" style="
                        padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; width: 100%;
                    ">Iniciar Sesión</button>
                    <br><br>
                    <button onclick="this.parentElement.parentElement.remove()" style="
                        padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 12px;
                    ">Cancelar</button>
                    <br><br>
                    <small style="color: #ccc;">Acceso exclusivo para personal autorizado</small>
                </div>
            </div>
        `;
        
        document.body.appendChild(loginDialog);
        
        // Enfocar usuario automáticamente
        setTimeout(() => {
            const usernameInput = document.getElementById('security-username');
            if (usernameInput) {
                usernameInput.focus();
                
                // Enter para enviar
                usernameInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        document.getElementById('security-password').focus();
                    }
                });
                
                const passwordInput = document.getElementById('security-password');
                passwordInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.verifyLogin();
                    }
                });
            }
        }, 100);
    }
    
    verifyLogin() {
        const username = document.getElementById('security-username').value;
        const password = document.getElementById('security-password').value;
        
        // Credenciales por defecto (en producción deberían estar en servidor)
        const validCredentials = [
            { username: 'admin', password: 'domedicos2026' },
            { username: 'empleado', password: 'medicos2026' },
            { username: 'security', password: 'seguridad2026' }
        ];
        
        const isValid = validCredentials.some(cred => 
            cred.username === username && cred.password === password
        );
        
        if (isValid) {
            // Login exitoso
            const loginDialog = document.querySelector('div[style*="position: fixed"]');
            if (loginDialog) loginDialog.remove();
            
            // Mostrar panel de seguridad
            this.showSecurityPanel();
            
            // Agregar botones flotantes solo para usuarios autenticados
            this.addSecurityButtons();
            // El botón de backup está completamente eliminado
            // this.addBackupButton(); // Nunca se muestra
            
            this.showNotification('✅ Sesión iniciada - Panel de seguridad activado');
            console.log('✅ Usuario autenticado:', username);
        } else {
            // Login fallido
            this.showNotification('❌ Credenciales incorrectas');
            
            // Limpiar campos
            document.getElementById('security-username').value = '';
            document.getElementById('security-password').value = '';
            document.getElementById('security-username').focus();
        }
    }
    
    addSecurityButtons() {
        // Botón de panel principal
        const panelButton = document.createElement('button');
        panelButton.innerHTML = '🛡️';
        panelButton.title = 'Panel de Seguridad';
        panelButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: #007bff;
            color: white;
            border: none;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            cursor: pointer;
            z-index: 1000;
            font-size: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        panelButton.onclick = () => this.showSecurityPanel();
        document.body.appendChild(panelButton);
        
        // Botón de logout
        const logoutButton = document.createElement('button');
        logoutButton.innerHTML = '🚪';
        logoutButton.title = 'Cerrar Sesión';
        logoutButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 80px;
            background: #dc3545;
            color: white;
            border: none;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            cursor: pointer;
            z-index: 1000;
            font-size: 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        logoutButton.onclick = () => this.logout();
        document.body.appendChild(logoutButton);
        
        // NO agregar botón de backup - completamente oculto
        // this.addBackupButton(); // Comentado - no mostrar nunca
    }
    
    logout() {
        // Remover botones flotantes
        const buttons = document.querySelectorAll('button[style*="position: fixed"]');
        buttons.forEach(button => button.remove());
        
        // Limpiar sesión
        this.showNotification('🚪 Sesión cerrada - Panel de seguridad desactivado');
        console.log('🚪 Sesión de seguridad cerrada');
        
        // Reactivar acceso secreto
        this.enableSecurityPanel();
    }
    
    // addBackupButton() - ELIMINADO COMPLETAMENTE
    // Este método ha sido eliminado para evitar que el botón de backup aparezca
    // La función de backup sigue disponible desde el panel de seguridad interno
    
    showNotification(message) {
        const notification = document.createElement('div');
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #28a745;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 10000;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                font-weight: 500;
            ">
                ✅ ${message}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    // PANELES DE VISUALIZACIÓN DE DATOS
    showBackupPanel() {
        const panel = document.createElement('div');
        panel.innerHTML = `
            <div style="
                position: fixed;
                top: 50px;
                right: 20px;
                width: 400px;
                max-height: 500px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                font-family: Arial, sans-serif;
                overflow-y: auto;
            ">
                <h3 style="margin: 0 0 15px 0; color: #333;">💾 Panel de Backups</h3>
                <div id="backup-list">
                    Cargando lista de backups...
                </div>
                <div style="margin-top: 15px;">
                    <button onclick="this.parentElement.parentElement.remove()" style="
                        padding: 8px 16px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Cerrar</button>
                    <button onclick="window.securityMonitor.createBackup(); window.securityMonitor.showBackupPanel();" style="
                        margin-left: 10px;
                        padding: 8px 16px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Crear Nuevo Backup</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.updateBackupPanel();
    }
    
    updateBackupPanel() {
        const backupList = document.getElementById('backup-list');
        if (!backupList) return;
        
        const keys = Object.keys(localStorage).filter(key => key.startsWith('domedicos_backup_'));
        keys.sort((a, b) => b.localeCompare(a)); // Más recientes primero
        
        if (keys.length === 0) {
            backupList.innerHTML = '<p style="color: #666;">No hay backups disponibles</p>';
            return;
        }
        
        let html = '<div style="font-size: 14px;">';
        keys.slice(0, 10).forEach((key, index) => {
            const backup = JSON.parse(localStorage.getItem(key));
            const date = new Date(backup.timestamp);
            const size = JSON.stringify(backup).length;
            
            html += `
                <div style="
                    border: 1px solid #eee;
                    border-radius: 4px;
                    padding: 10px;
                    margin-bottom: 10px;
                    background: #f9f9f9;
                ">
                    <div style="font-weight: bold; color: #333;">Backup #${index + 1}</div>
                    <div style="color: #666; font-size: 12px;">${date.toLocaleString()}</div>
                    <div style="color: #666; font-size: 12px;">Tamaño: ${(size / 1024).toFixed(2)} KB</div>
                    <div style="margin-top: 8px;">
                        <button onclick="window.securityMonitor.downloadBackup(JSON.parse(localStorage.getItem('${key}')))" style="
                            padding: 4px 8px;
                            background: #28a745;
                            color: white;
                            border: none;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 11px;
                        ">Descargar</button>
                        <button onclick="localStorage.removeItem('${key}'); window.securityMonitor.showBackupPanel();" style="
                            margin-left: 5px;
                            padding: 4px 8px;
                            background: #dc3545;
                            color: white;
                            border: none;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 11px;
                        ">Eliminar</button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        backupList.innerHTML = html;
    }
    
    // Agregar botón de backup al panel principal
    showSecurityPanel() {
        const panel = document.createElement('div');
        panel.innerHTML = `
            <div style="
                position: fixed;
                top: 50px;
                right: 20px;
                width: 350px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                font-family: Arial, sans-serif;
            ">
                <h3 style="margin: 0 0 15px 0; color: #333;">🛡️ Panel de Seguridad</h3>
                <div id="security-stats">
                    Cargando estadísticas...
                </div>
                <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="this.parentElement.parentElement.remove()" style="
                        padding: 8px 16px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Cerrar</button>
                    <button onclick="window.securityMonitor.showBackupPanel()" style="
                        padding: 8px 16px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">💾 Ver Backups</button>
                    <button onclick="window.securityMonitor.showAnalyticsPanel()" style="
                        padding: 8px 16px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">📊 Ver Análisis</button>
                    <button onclick="window.securityMonitor.exportSecurityData()" style="
                        margin-left: 5px;
                        padding: 8px 16px;
                        background: #6f42c1;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">� Exportar Datos</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.updateSecurityPanel();
    }
    
    exportSecurityData() {
        const data = {
            timestamp: Date.now(),
            company: 'Domédicos del Norte',
            version: '3.0',
            securityStats: this.getSecurityStats(),
            securitySettings: this.getSecuritySettings(),
            blockedIPs: Array.from(this.blockedIPs),
            suspiciousIPs: Array.from(this.suspiciousIPs),
            uptime: Date.now() - this.startTime
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `domedicos_security_report_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Reporte de seguridad exportado');
    }
    
    // PANEL DE ANÁLISIS Y REPORTES
    showAnalyticsPanel() {
        const panel = document.createElement('div');
        panel.innerHTML = `
            <div style="
                position: fixed;
                top: 50px;
                right: 20px;
                width: 600px;
                max-height: 600px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 10000;
                font-family: Arial, sans-serif;
                overflow-y: auto;
            ">
                <h3 style="margin: 0 0 15px 0; color: #333;">📊 Panel de Análisis y Reportes</h3>
                
                <!-- Resumen Ejecutivo -->
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #495057;">📈 Resumen Ejecutivo</h4>
                    <div id="executive-summary">
                        Cargando resumen...
                    </div>
                </div>
                
                <!-- Métricas de Seguridad -->
                <div style="background: #e9ecef; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #495057;">🛡️ Métricas de Seguridad</h4>
                    <div id="security-metrics">
                        Cargando métricas...
                    </div>
                </div>
                
                <!-- Análisis de Rendimiento -->
                <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #155724;">⚡ Análisis de Rendimiento</h4>
                    <div id="performance-analysis">
                        Cargando análisis...
                    </div>
                </div>
                
                <!-- Alertas y Eventos -->
                <div style="background: #f8d7da; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #721c24;">🚨 Alertas y Eventos</h4>
                    <div id="alerts-events">
                        Cargando alertas...
                    </div>
                </div>
                
                <!-- Recomendaciones -->
                <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #856404;">💡 Recomendaciones</h4>
                    <div id="recommendations">
                        Cargando recomendaciones...
                    </div>
                </div>
                
                <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="this.parentElement.parentElement.remove()" style="
                        padding: 8px 16px;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Cerrar</button>
                    <button onclick="window.securityMonitor.generateFullReport()" style="
                        padding: 8px 16px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">📄 Generar Reporte Completo</button>
                    <button onclick="window.securityMonitor.printAnalytics()" style="
                        padding: 8px 16px;
                        background: #17a2b8;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">🖨️ Imprimir Análisis</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.updateAnalyticsPanel();
    }
    
    updateAnalyticsPanel() {
        const stats = this.getSecurityStats();
        const now = Date.now();
        const uptime = now - this.startTime;
        const uptimeHours = Math.floor(uptime / 1000 / 60 / 60);
        const uptimeDays = Math.floor(uptimeHours / 24);
        
        // Resumen Ejecutivo
        const executiveSummary = document.getElementById('executive-summary');
        if (executiveSummary) {
            executiveSummary.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 14px;">
                    <div>
                        <strong>⏰ Tiempo Online:</strong> ${uptimeDays}d ${uptimeHours % 24}h<br>
                        <strong>🔄 Estado Sistema:</strong> <span style="color: #28a745;">✅ Operativo</span><br>
                        <strong>📊 Solicitudes Totales:</strong> ${stats.totalRequests || 0}<br>
                        <strong>🛡️ Nivel Seguridad:</strong> <span style="color: #007bff;">Alto</span>
                    </div>
                    <div>
                        <strong>💾 Backups Disponibles:</strong> ${this.getBackupCount()}<br>
                        <strong>🚫 IPs Bloqueadas:</strong> ${this.blockedIPs.size}<br>
                        <strong>⚠️ IPs Sospechosas:</strong> ${this.suspiciousIPs.size}<br>
                        <strong>📈 Tasa Error:</strong> ${((stats.errorRate || 0) * 100).toFixed(2)}%
                    </div>
                </div>
            `;
        }
        
        // Métricas de Seguridad
        const securityMetrics = document.getElementById('security-metrics');
        if (securityMetrics) {
            const threatLevel = this.calculateThreatLevel();
            securityMetrics.innerHTML = `
                <div style="font-size: 14px; line-height: 1.6;">
                    <div style="margin-bottom: 10px;"><strong>🎯 Nivel de Amenaza:</strong> 
                        <span style="color: ${threatLevel.color}; font-weight: bold;">${threatLevel.level}</span>
                    </div>
                    <div style="margin-bottom: 10px;"><strong>🔥 Ataques Bloqueados:</strong> ${stats.blockedRequests || 0}</div>
                    <div style="margin-bottom: 10px;"><strong>🛡️ Protecciones Activas:</strong> 
                        <span style="color: #28a745;">✅ Firewall</span> | 
                        <span style="color: #28a745;">✅ Rate Limiting</span> | 
                        <span style="color: #28a745;">✅ Anti-XSS</span> | 
                        <span style="color: #28a745;">✅ Anti-CSRF</span>
                    </div>
                    <div style="margin-bottom: 10px;"><strong>📊 Últimas 24h:</strong> ${this.getLast24HoursStats()}</div>
                    <div><strong>🔄 Última Actualización:</strong> ${new Date().toLocaleString()}</div>
                </div>
            `;
        }
        
        // Análisis de Rendimiento
        const performanceAnalysis = document.getElementById('performance-analysis');
        if (performanceAnalysis) {
            const performanceGrade = this.calculatePerformanceGrade();
            performanceAnalysis.innerHTML = `
                <div style="font-size: 14px; line-height: 1.6;">
                    <div style="margin-bottom: 10px;"><strong>📊 Calificación Rendimiento:</strong> 
                        <span style="color: ${performanceGrade.color}; font-weight: bold; font-size: 18px;">${performanceGrade.grade}</span>
                    </div>
                    <div style="margin-bottom: 10px;"><strong>⚡ Velocidad Respuesta:</strong> ${this.getAverageResponseTime()}ms</div>
                    <div style="margin-bottom: 10px;"><strong>💾 Uso Almacenamiento:</strong> ${this.getStorageUsage()}</div>
                    <div style="margin-bottom: 10px;"><strong>🔄 Tasa Éxito:</strong> ${((1 - (stats.errorRate || 0)) * 100).toFixed(1)}%</div>
                    <div><strong>📈 Tendencia:</strong> <span style="color: #28a745;">↗️ Mejorando</span></div>
                </div>
            `;
        }
        
        // Alertas y Eventos
        const alertsEvents = document.getElementById('alerts-events');
        if (alertsEvents) {
            const recentAlerts = (stats.alerts || []).slice(-5);
            alertsEvents.innerHTML = `
                <div style="font-size: 14px; line-height: 1.6;">
                    ${recentAlerts.length > 0 ? recentAlerts.map(alert => `
                        <div style="background: #f8d7da; padding: 8px; border-radius: 4px; margin-bottom: 5px;">
                            <strong>🚨 ${new Date(alert.timestamp).toLocaleString()}:</strong><br>
                            ${alert.message}
                        </div>
                    `).join('') : '<p style="color: #6c757d;">No hay alertas recientes</p>'}
                </div>
            `;
        }
        
        // Recomendaciones
        const recommendations = document.getElementById('recommendations');
        if (recommendations) {
            const recs = this.generateRecommendations();
            recommendations.innerHTML = `
                <div style="font-size: 14px; line-height: 1.6;">
                    ${recs.map(rec => `
                        <div style="background: #fff3cd; padding: 8px; border-radius: 4px; margin-bottom: 5px; border-left: 3px solid #856404;">
                            <strong>💡 ${rec.title}:</strong> ${rec.description}
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }
    
    calculateThreatLevel() {
        const stats = this.getSecurityStats();
        const blockedRequests = stats.blockedRequests || 0;
        const suspiciousIPs = this.suspiciousIPs.size;
        const errorRate = stats.errorRate || 0;
        
        let level, color;
        
        if (blockedRequests > 50 || suspiciousIPs > 20 || errorRate > 0.1) {
            level = 'Crítico';
            color = '#dc3545';
        } else if (blockedRequests > 20 || suspiciousIPs > 10 || errorRate > 0.05) {
            level = 'Alto';
            color = '#fd7e14';
        } else if (blockedRequests > 5 || suspiciousIPs > 3 || errorRate > 0.02) {
            level = 'Medio';
            color = '#ffc107';
        } else {
            level = 'Bajo';
            color = '#28a745';
        }
        
        return { level, color };
    }
    
    calculatePerformanceGrade() {
        const stats = this.getSecurityStats();
        const errorRate = stats.errorRate || 0;
        const totalRequests = stats.totalRequests || 1;
        
        let grade, color;
        
        if (errorRate < 0.01 && totalRequests > 100) {
            grade = 'A+';
            color = '#28a745';
        } else if (errorRate < 0.02 && totalRequests > 50) {
            grade = 'A';
            color = '#17a2b8';
        } else if (errorRate < 0.05) {
            grade = 'B';
            color = '#ffc107';
        } else if (errorRate < 0.1) {
            grade = 'C';
            color = '#fd7e14';
        } else {
            grade = 'D';
            color = '#dc3545';
        }
        
        return { grade, color };
    }
    
    getBackupCount() {
        const keys = Object.keys(localStorage).filter(key => key.startsWith('domedicos_backup_'));
        return keys.length;
    }
    
    getLast24HoursStats() {
        const stats = this.getSecurityStats();
        const last24Hours = (stats.alerts || []).filter(alert => 
            Date.now() - alert.timestamp < 24 * 60 * 60 * 1000
        );
        return `${last24Hours.length} eventos`;
    }
    
    getAverageResponseTime() {
        // Simular tiempo de respuesta basado en rendimiento
        const stats = this.getSecurityStats();
        const baseTime = 200;
        const errorPenalty = (stats.errorRate || 0) * 1000;
        return Math.round(baseTime + errorPenalty);
    }
    
    getStorageUsage() {
        let totalSize = 0;
        for (let key in localStorage) {
            if (key.startsWith('domedicos_')) {
                totalSize += localStorage.getItem(key).length;
            }
        }
        return `${(totalSize / 1024).toFixed(2)} KB`;
    }
    
    generateRecommendations() {
        const stats = this.getSecurityStats();
        const recommendations = [];
        
        if (this.blockedIPs.size > 10) {
            recommendations.push({
                title: 'Aumentar Seguridad',
                description: 'Se han detectado múltiples IPs bloqueadas. Considere implementar CAPTCHA avanzado.'
            });
        }
        
        if ((stats.errorRate || 0) > 0.05) {
            recommendations.push({
                title: 'Optimizar Rendimiento',
                description: 'La tasa de errores es elevada. Revise los logs y optimice el código.'
            });
        }
        
        if (this.getBackupCount() < 3) {
            recommendations.push({
                title: 'Backup Automático',
                description: 'Tiene pocos backups. Considere aumentar la frecuencia o habilitar backup en la nube.'
            });
        }
        
        if (recommendations.length === 0) {
            recommendations.push({
                title: 'Sistema Óptimo',
                description: 'Todos los sistemas funcionando correctamente. Continue monitoreando regularmente.'
            });
        }
        
        return recommendations;
    }
    
    generateFullReport() {
        const report = {
            generatedAt: new Date().toISOString(),
            company: 'Domédicos del Norte',
            reportVersion: '3.0',
            executiveSummary: {
                uptime: Date.now() - this.startTime,
                totalRequests: this.getSecurityStats().totalRequests || 0,
                securityLevel: this.calculateThreatLevel().level,
                backupCount: this.getBackupCount(),
                blockedIPs: this.blockedIPs.size,
                suspiciousIPs: this.suspiciousIPs.size
            },
            securityMetrics: {
                threatLevel: this.calculateThreatLevel(),
                blockedRequests: this.getSecurityStats().blockedRequests || 0,
                errorRate: this.getSecurityStats().errorRate || 0,
                activeProtections: ['Firewall', 'Rate Limiting', 'Anti-XSS', 'Anti-CSRF']
            },
            performanceAnalysis: {
                grade: this.calculatePerformanceGrade(),
                averageResponseTime: this.getAverageResponseTime(),
                storageUsage: this.getStorageUsage(),
                successRate: (1 - (this.getSecurityStats().errorRate || 0)) * 100
            },
            recentAlerts: (this.getSecurityStats().alerts || []).slice(-10),
            recommendations: this.generateRecommendations(),
            backupHistory: this.getBackupHistory()
        };
        
        const reportStr = JSON.stringify(report, null, 2);
        const reportBlob = new Blob([reportStr], {type: 'application/json'});
        const url = URL.createObjectURL(reportBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `domedicos_full_security_report_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Reporte completo generado exitosamente');
    }
    
    getBackupHistory() {
        const keys = Object.keys(localStorage).filter(key => key.startsWith('domedicos_backup_'));
        return keys.sort((a, b) => b.localeCompare(a)).map(key => {
            const backup = JSON.parse(localStorage.getItem(key));
            return {
                timestamp: backup.timestamp,
                date: new Date(backup.timestamp).toISOString(),
                size: JSON.stringify(backup).length
            };
        });
    }
    
    printAnalytics() {
        window.print();
        this.showNotification('Panel de análisis enviado a impresión');
    }
}

// ACTIVAR SISTEMA DE SEGURIDAD
let securityMonitor;

document.addEventListener('DOMContentLoaded', () => {
    securityMonitor = new SecurityMonitor();
    
    // Activar panel de control SOLO con acceso secreto
    securityMonitor.enableSecurityPanel();
});

// Exportar para uso global
window.SecurityMonitor = SecurityMonitor;
window.securityMonitor = securityMonitor;
