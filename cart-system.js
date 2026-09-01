/**
 * Carrito de Cotización para Domédicos del Norte
 * Sistema de cotización multi-producto con envío a WhatsApp
 * @charset UTF-8
 */

class CotizacionCart {
    constructor() {
        this.items = [];
        this.cartCount = 0;
        this.isCartOpen = false;
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.createCartUI();
        this.setupEventListeners();
        this.updateCartDisplay();
        this.setupProductButtons();
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem('domedicos_cart');
            if (stored) {
                this.items = JSON.parse(stored);
                this.cartCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
            }
        } catch (error) {
            console.error('Error loading cart from storage:', error);
            this.items = [];
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('domedicos_cart', JSON.stringify(this.items));
        } catch (error) {
            console.error('Error saving cart to storage:', error);
        }
    }

    createCartUI() {
        // Botón flotante del carrito
        const cartButton = document.createElement('div');
        cartButton.innerHTML = `
            <div id="cart-button" style="
                position: fixed;
                bottom: 20px;
                right: 90px;
                background: linear-gradient(135deg, #25d366, #128c7e);
                color: white;
                border-radius: 50%;
                width: 60px;
                height: 60px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
                transition: all 0.3s ease;
                font-size: 24px;
            ">
                🛒
                <span id="cart-count" style="
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #ff0000;
                    color: white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    border: 2px solid white;
                ">0</span>
            </div>
        `;
        document.body.appendChild(cartButton);

        // Modal del carrito
        const cartModal = document.createElement('div');
        cartModal.innerHTML = `
            <div id="cart-modal" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.8);
                display: none;
                z-index: 10001;
                animation: fadeIn 0.3s ease;
            ">
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    border-radius: 15px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    animation: slideUp 0.3s ease;
                ">
                    <div style="
                        background: linear-gradient(135deg, #25d366, #128c7e);
                        color: white;
                        padding: 20px;
                        border-radius: 15px 15px 0 0;
                        position: relative;
                    ">
                        <h3 style="margin: 0; display: flex; align-items: center; justify-content: space-between;">
                            <span>🛒 Carrito de Cotización</span>
                            <button id="close-cart" style="
                                background: none;
                                border: none;
                                color: white;
                                font-size: 24px;
                                cursor: pointer;
                                padding: 0;
                                width: 30px;
                                height: 30px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                border-radius: 50%;
                                transition: background 0.3s ease;
                            ">×</button>
                        </h3>
                    </div>
                    <div id="cart-items" style="padding: 20px; max-height: 400px; overflow-y: auto;">
                        <!-- Items se cargan dinámicamente -->
                    </div>
                    <div style="
                        padding: 20px;
                        border-top: 1px solid #eee;
                        background: #f8f9fa;
                        border-radius: 0 0 15px 15px;
                    ">
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 15px;
                        ">
                            <span style="font-weight: bold; color: #333;">Total de productos:</span>
                            <span id="total-items" style="font-weight: bold; color: #25d366; font-size: 18px;">0</span>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button id="clear-cart" style="
                                background: #dc3545;
                                color: white;
                                border: none;
                                padding: 12px 20px;
                                border-radius: 8px;
                                cursor: pointer;
                                flex: 1;
                                transition: all 0.3s ease;
                            ">🗑️ Vaciar Carrito</button>
                            <button id="send-cotizacion" style="
                                background: linear-gradient(135deg, #25d366, #128c7e);
                                color: white;
                                border: none;
                                padding: 12px 20px;
                                border-radius: 8px;
                                cursor: pointer;
                                flex: 2;
                                font-weight: bold;
                                transition: all 0.3s ease;
                            ">📱 Enviar por WhatsApp</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { 
                        opacity: 0;
                        transform: translate(-50%, -40%);
                    }
                    to { 
                        opacity: 1;
                        transform: translate(-50%, -50%);
                    }
                }
                #cart-button:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 16px rgba(37, 211, 102, 0.4);
                }
                #clear-cart:hover {
                    background: #c82333;
                    transform: translateY(-2px);
                }
                #send-cotizacion:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3);
                }
                #close-cart:hover {
                    background: rgba(255,255,255,0.2);
                }
            </style>
        `;
        document.body.appendChild(cartModal);
    }

    setupEventListeners() {
        // Abrir/cerrar carrito
        document.getElementById('cart-button').addEventListener('click', () => {
            this.openCart();
        });

        // Cerrar modal
        document.getElementById('close-cart').addEventListener('click', () => {
            this.closeCart();
        });

        // Cerrar al hacer clic fuera
        document.getElementById('cart-modal').addEventListener('click', (e) => {
            if (e.target.id === 'cart-modal') {
                this.closeCart();
            }
        });

        // Tecla ESC para cerrar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isCartOpen) {
                this.closeCart();
            }
        });

        // Vaciar carrito
        document.getElementById('clear-cart').addEventListener('click', () => {
            this.clearCart();
        });

        // Enviar cotización
        document.getElementById('send-cotizacion').addEventListener('click', () => {
            this.sendToWhatsApp();
        });
    }

    setupProductButtons() {
        // Modificar botones de cotización existentes
        document.querySelectorAll('.btn-cotizar').forEach(btn => {
            const article = btn.closest('.article');
            if (article) {
                const productName = article.querySelector('.article-title').textContent;
                const category = this.getProductCategory(article);
                const imageUrl = article.querySelector('img').src;
                
                // Reemplazar comportamiento del botón
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.addItem(productName, category, imageUrl);
                });
                
                // Cambiar texto del botón
                btn.innerHTML = '<span>Agregar al Carrito</span><span>🛒</span>';
            }
        });
    }

    getProductCategory(article) {
        if (!article) return 'general';
        
        const breadcrumb = document.querySelector('.breadcrumb');
        if (breadcrumb) {
            const breadcrumbText = breadcrumb.textContent;
            if (breadcrumbText.includes('Diagnóstico')) return 'Equipos de Diagnóstico';
            if (breadcrumbText.includes('Movilidad')) return 'Movilidad';
            if (breadcrumbText.includes('Hospitalario')) return 'Equipos Hospitalarios';
            if (breadcrumbText.includes('Insumos')) return 'Insumos Médicos';
            if (breadcrumbText.includes('Repuestos')) return 'Repuestos';
            if (breadcrumbText.includes('Especializados')) return 'Equipos Especializados';
        }
        
        return 'Equipos Médicos';
    }

    openCart() {
        document.getElementById('cart-modal').style.display = 'flex';
        this.isCartOpen = true;
        this.updateCartDisplay();
    }

    closeCart() {
        document.getElementById('cart-modal').style.display = 'none';
        this.isCartOpen = false;
    }

    addItem(productName, category, imageUrl) {
        // Verificar si el producto ya está en el carrito
        const existingItem = this.items.find(item => item.name === productName);
        
        if (existingItem) {
            existingItem.quantity += 1;
            this.showNotification(`${productName} - Cantidad actualizada a ${existingItem.quantity}`);
        } else {
            this.items.push({
                name: productName,
                category: category,
                quantity: 1,
                imageUrl: imageUrl,
                addedAt: new Date().toISOString()
            });
            this.showNotification(`${productName} - Agregado al carrito`);
        }
        
        this.saveToStorage();
        this.updateCartDisplay();
        
        // Evento Analytics
        if (window.analyticsTracker) {
            window.analyticsTracker.trackEvent('add_to_cart', {
                'item_name': productName,
                'item_category': category,
                'quantity': 1
            });
        }
    }

    removeItem(index) {
        const itemName = this.items[index].name;
        this.items.splice(index, 1);
        this.saveToStorage();
        this.updateCartDisplay();
        this.showNotification(`${itemName} - Eliminado del carrito`);
    }

    updateQuantity(index, quantity) {
        if (quantity > 0 && quantity <= 99) {
            const itemName = this.items[index].name;
            this.items[index].quantity = quantity;
            this.saveToStorage();
            this.updateCartDisplay();
            this.showNotification(`${itemName} - Cantidad actualizada a ${quantity}`);
        }
    }

    clearCart() {
        if (this.items.length === 0) {
            this.showNotification('El carrito ya está vacío');
            return;
        }
        
        const itemCount = this.items.length;
        this.items = [];
        this.saveToStorage();
        this.updateCartDisplay();
        this.showNotification(`${itemCount} productos eliminados del carrito`);
    }

    updateCartDisplay() {
        const cartCount = document.getElementById('cart-count');
        const cartItems = document.getElementById('cart-items');
        const totalItems = document.getElementById('total-items');
        
        // Actualizar contador
        this.cartCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = this.cartCount;
        
        // Actualizar total
        totalItems.textContent = this.cartCount;
        
        // Actualizar items del modal
        if (this.items.length === 0) {
            cartItems.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 40px 20px;
                    color: #666;
                ">
                    <div style="font-size: 48px; margin-bottom: 10px;">🛒</div>
                    <p style="font-size: 16px; margin: 0;">Tu carrito está vacío</p>
                    <p style="font-size: 14px; margin: 10px 0 0 0;">Agrega productos para solicitar cotización</p>
                </div>
            `;
        } else {
            cartItems.innerHTML = this.items.map((item, index) => `
                <div style="
                    display: flex;
                    align-items: center;
                    padding: 15px;
                    border: 1px solid #eee;
                    border-radius: 10px;
                    margin-bottom: 10px;
                    background: white;
                    transition: all 0.3s ease;
                " onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" 
                   onmouseout="this.style.boxShadow='none'">
                    <img src="${item.imageUrl}" style="
                        width: 60px;
                        height: 60px;
                        object-fit: cover;
                        border-radius: 8px;
                        margin-right: 15px;
                        border: 1px solid #eee;
                    " onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0zMCAyMEMzNi42Mjc0IDIwIDQyIDMxLjM3MjYgNDIgMzhDMzEuMzcyNiA0MiAyMCAzNi42Mjc0IDIwIDMwQzIwIDIzLjM3MjYgMzEuMzcyNiAxOCAzOCAxOEM0Mi42Mjc0IDE4IDQ4IDIzLjM3MjYgNDggMzBDNDggMzYuNjI3NCA0Mi42Mjc0IDQyIDM4IDQyQzMxLjM3MjYgNDIgMjYgMzYuNjI3NCAyNiAzMEMyNiAyMy4zNzI2IDMxLjM3MjYgMTggMzggMThaIiBmaWxsPSIjMDA1Qjk5Ii8+Cjwvc3ZnPgo='">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #333; font-weight: 600;">${item.name}</h4>
                        <p style="margin: 0 0 8px 0; color: #666; font-size: 12px;">${item.category}</p>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button onclick="cart.updateQuantity(${index}, ${item.quantity - 1})" style="
                                background: #f8f9fa;
                                border: 1px solid #dee2e6;
                                width: 28px;
                                height: 28px;
                                border-radius: 5px;
                                cursor: pointer;
                                font-size: 14px;
                                transition: all 0.2s ease;
                            " onmouseover="this.style.background='#e9ecef'" 
                               onmouseout="this.style.background='#f8f9fa'">−</button>
                            <span style="
                                font-weight: bold;
                                min-width: 30px;
                                text-align: center;
                                color: #333;
                            ">${item.quantity}</span>
                            <button onclick="cart.updateQuantity(${index}, ${item.quantity + 1})" style="
                                background: #f8f9fa;
                                border: 1px solid #dee2e6;
                                width: 28px;
                                height: 28px;
                                border-radius: 5px;
                                cursor: pointer;
                                font-size: 14px;
                                transition: all 0.2s ease;
                            " onmouseover="this.style.background='#e9ecef'" 
                               onmouseout="this.style.background='#f8f9fa'">+</button>
                            <button onclick="cart.removeItem(${index})" style="
                                background: #dc3545;
                                color: white;
                                border: none;
                                padding: 4px 10px;
                                border-radius: 5px;
                                cursor: pointer;
                                font-size: 11px;
                                margin-left: 8px;
                                transition: all 0.2s ease;
                            " onmouseover="this.style.background='#c82333'" 
                               onmouseout="this.style.background='#dc3545'">Eliminar</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    sendToWhatsApp() {
        if (this.items.length === 0) {
            this.showNotification('El carrito está vacío. Agrega productos primero.');
            return;
        }
        
        // Construir mensaje detallado
        let message = '🩺 **DOMÉDICOS DEL NORTE – SOLICITUD DE COTIZACIÓN**\n\n';
        message += 'Hola, deseo cotizar los siguientes productos:\n\n';
        
        // Agrupar productos por categoría
        const groupedItems = this.items.reduce((groups, item) => {
            if (!groups[item.category]) {
                groups[item.category] = [];
            }
            groups[item.category].push(item);
            return groups;
        }, {});
        
        Object.keys(groupedItems).forEach((category, catIndex) => {
            message += `📁 **${category.toUpperCase()}**\n`;
            groupedItems[category].forEach((item, index) => {
                message += `• ${item.name}\n`;
            });
            message += '\n';
        });
        
        message += 'Gracias.\n\n';
        message += ' *Teléfono de contacto:* +57 310 610 7017\n';
        message += '📧 *Email:* domedicosdelnorte@hotmail.com';
        
        // Codificar mensaje para WhatsApp
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/573106107017?text=${encodedMessage}`;
        
        // Abrir WhatsApp en nueva ventana
        window.open(whatsappUrl, '_blank');
        
        // Evento Analytics
        if (window.analyticsTracker) {
            window.analyticsTracker.trackEvent('begin_checkout', {
                'value': this.cartCount,
                'currency': 'COP',
                'items': this.items.map(item => ({
                    'item_name': item.name,
                    'item_category': item.category,
                    'quantity': item.quantity
                }))
            });
            
            window.analyticsTracker.trackWhatsAppConversion('cotizacion_multiple', '573106107017');
        }
        
        // Mostrar notificación y limpiar carrito
        this.showNotification('📱 Enviando cotización por WhatsApp...');
        
        setTimeout(() => {
            this.clearCart();
            this.closeCart();
            this.showNotification('✅ Cotización enviada correctamente');
        }, 2000);
    }

    showNotification(message) {
        // Eliminar notificaciones existentes
        const existingNotifications = document.querySelectorAll('.cart-notification');
        existingNotifications.forEach(notif => notif.remove());
        
        const notification = document.createElement('div');
        notification.className = 'cart-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10002;
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
            font-size: 14px;
            max-width: 300px;
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Animación de entrada
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    // Métodos públicos para acceso desde otros scripts
    getCartCount() {
        return this.cartCount;
    }

    getCartItems() {
        return [...this.items];
    }

    getTotalValue() {
        return this.cartCount;
    }
}

// Inicializar carrito cuando el DOM esté listo
let cart;

function initializeCart() {
    cart = new CotizacionCart();
    window.cart = cart;
    
    console.log('🛒 Carrito de cotización inicializado');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCart);
} else {
    initializeCart();
}

// Exportar para uso global
window.CotizacionCart = CotizacionCart;
