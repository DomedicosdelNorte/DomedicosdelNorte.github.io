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
        this.maxRequestsPerWindow = 100;
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

        // Verificar rate limit
        const recentRequests = clientRequests.filter(
            req => now - req.timestamp < this.rateLimitWindow
        );

        if (recentRequests.length > this.maxRequestsPerWindow) {
            this.handleRateLimitExceeded(clientId);
        }

        this.requests.set(clientId, recentRequests);
    }

    handleRateLimitExceeded(clientId) {
        console.warn(`🚨 Rate limit excedido para cliente: ${clientId}`);
        this.suspiciousIPs.add(clientId);
        
        // Mostrar advertencia
        this.showRateLimitWarning();
        
        // Bloquear temporalmente si es repetido
        if (this.suspiciousIPs.has(clientId)) {
            this.temporaryBlock(clientId);
        }
    }

    showRateLimitWarning() {
        const warning = document.createElement('div');
        warning.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ff6b6b;
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                z-index: 10000;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            ">
                ⚠️ Actividad sospechosa detectada. Por favor, reduzca la velocidad de navegación.
            </div>
        `;
        
        document.body.appendChild(warning);
        
        setTimeout(() => {
            warning.remove();
        }, 5000);
    }

    temporaryBlock(clientId) {
        console.warn(`🚫 Cliente bloqueado temporalmente: ${clientId}`);
        this.blockedIPs.add(clientId);
        
        // Mostrar mensaje de bloqueo
        this.showBlockedMessage();
        
        // Desbloquear después de 5 minutos
        setTimeout(() => {
            this.blockedIPs.delete(clientId);
            this.suspiciousIPs.delete(clientId);
        }, 300000);
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
                background: rgba(0,0,0,0.9);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10001;
                font-size: 18px;
            ">
                <div style="text-align: center;">
                    🚫 Acceso Bloqueado Temporalmente
                    <br><br>
                    Se ha detectado actividad sospechosa.
                    <br>
                    Por favor, espere 5 minutos antes de continuar.
                </div>
            </div>
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 5000);
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
        // Monitorear eventos inusuales
        let keyboardMashCount = 0;
        let lastKeyboardTime = 0;

        document.addEventListener('keydown', (e) => {
            const now = Date.now();
            
            // Detectar keyboard mashing (ataque de fuerza bruta)
            if (now - lastKeyboardTime < 50) {
                keyboardMashCount++;
                if (keyboardMashCount > 20) {
                    this.handleAnomaly('Keyboard mashing detectado');
                    keyboardMashCount = 0;
                }
            } else {
                keyboardMashCount = 0;
            }
            lastKeyboardTime = now;
        });

        // Detectar clicks rápidos (click bombing)
        let clickCount = 0;
        let clickStartTime = 0;

        document.addEventListener('click', () => {
            const now = Date.now();
            
            if (clickCount === 0) {
                clickStartTime = now;
            }
            
            clickCount++;
            
            if (now - clickStartTime < 1000 && clickCount > 10) {
                this.handleAnomaly('Click bombing detectado');
                clickCount = 0;
            } else if (now - clickStartTime > 1000) {
                clickCount = 0;
            }
        });
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

    // MÉTODO PÚBLICO PARA ACTIVAR PANEL
    enableSecurityPanel() {
        // Agregar botón flotante para panel
        const button = document.createElement('button');
        button.innerHTML = '🛡️';
        button.style.cssText = `
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
        
        button.onclick = () => this.showSecurityPanel();
        document.body.appendChild(button);
        
        // Agregar botón de backup manual
        this.addBackupButton();
    }
    
    addBackupButton() {
        // Botón de backup manual visible para todos
        const backupButton = document.createElement('button');
        backupButton.innerHTML = '💾';
        backupButton.title = 'Crear Backup Manual';
        backupButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 80px;
            background: #28a745;
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
        
        backupButton.onclick = () => {
            this.createBackup();
            this.showNotification('Backup creado exitosamente');
        };
        
        document.body.appendChild(backupButton);
    }
    
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
                    <button onclick="window.securityMonitor.exportSecurityData()" style="
                        padding: 8px 16px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    ">📊 Exportar Datos</button>
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
}

// ACTIVAR SISTEMA DE SEGURIDAD
let securityMonitor;

document.addEventListener('DOMContentLoaded', () => {
    securityMonitor = new SecurityMonitor();
    
    // Activar panel de control para todos los usuarios
    securityMonitor.enableSecurityPanel();
});

// Exportar para uso global
window.SecurityMonitor = SecurityMonitor;
window.securityMonitor = securityMonitor;
