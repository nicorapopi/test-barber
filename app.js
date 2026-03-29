document.addEventListener('DOMContentLoaded', () => {

    /* --- 1. UI Initialization --- */
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-sidebar');

    // Toggle Sidebar
    toggleBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('mobile-open');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    });

    // Handle Resize
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('mobile-open');
        } else {
            sidebar.classList.remove('collapsed');
        }
    });

    // Live Clock
    const timeElement = document.getElementById('current-time');
    function updateTime() {
        const now = new Date();
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        timeElement.textContent = now.toLocaleDateString('th-TH', options);
    }
    setInterval(updateTime, 1000);
    updateTime();

    /* --- 2. Navigation Logic --- */
    const navItems = document.querySelectorAll('.nav-item');
    const dashboardView = document.getElementById('view-dashboard');
    const placeholderView = document.getElementById('view-placeholder');
    const placeholderName = document.getElementById('placeholder-name');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Remove active class from all
            navItems.forEach(nav => nav.classList.remove('active'));

            // Add active class to clicked
            item.classList.add('active');

            const target = item.getAttribute('data-target');

            // Handle View Switching
            const views = document.querySelectorAll('.view');
            views.forEach(v => v.classList.remove('active'));

            const targetView = document.getElementById(`view-${target}`);
            if (targetView) {
                targetView.classList.add('active');
                
                // Fetch data when switching to specific views
                if (target === 'customers') fetchAndRenderCustomers();
                else if (target === 'staff') fetchAndRenderStaff();
                else if (target === 'services') fetchAndRenderServices();
                else if (target === 'products') fetchAndRenderProducts();
                else if (target === 'pos') fetchAndRenderPOS();
                else if (target === 'reports') fetchAndRenderReports();
                else if (target === 'dashboard') fetchAndRenderQueue();
            } else {
                placeholderView.classList.add('active');
                // Set placeholder name based on nav item text
                placeholderName.textContent = item.querySelector('span').textContent;
            }

            // Close mobile sidebar on click
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('mobile-open');
            }
        });
    });

    /* --- 3. API Data Rendering (Queue) --- */
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000';
    const API_URL = `${API_BASE_URL}/api/queues`;
    const queueTableBody = document.getElementById('queue-table-body');

    async function fetchAndRenderQueue() {
        try {
            const response = await fetch(API_URL);
            const queues = await response.json();

            queueTableBody.innerHTML = '';

            queues.forEach(q => {
                const tr = document.createElement('tr');

                let statusIcon = '';
                if (q.statusClass === 'status-serving') statusIcon = '<i class="fa-solid fa-cut"></i>';
                else if (q.statusClass === 'status-waiting') statusIcon = '<i class="fa-solid fa-clock"></i>';
                else if (q.statusClass === 'status-done') statusIcon = '<i class="fa-solid fa-check-circle"></i>';

                tr.innerHTML = `
                    <td><span class="queue-number">${q.queueNo}</span></td>
                    <td>
                        <div class="flex-item">
                            <img src="https://ui-avatars.com/api/?name=${q.avatarKey}&background=random&color=fff" class="avatar-sm" alt="${q.customerName}">
                            <span>${q.customerName}</span>
                        </div>
                    </td>
                    <td>${q.service}</td>
                    <td>
                        <div class="flex-item">
                            <i class="fa-solid fa-user-tie text-muted"></i>
                            <span>${q.barber}</span>
                        </div>
                    </td>
                    <td>
                        <span class="status-badge ${q.statusClass}">
                            ${statusIcon} ${q.status}
                        </span>
                    </td>
                    <td>${q.waitTime}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon accent" title="แก้ไข"><i class="fa-solid fa-pen"></i></button>
                            ${q.statusClass === 'status-waiting' ? `<button class="btn-icon success" title="เริ่มให้บริการ" onclick="updateQueueStatus(${q.id}, 'กำลังให้บริการ', 'status-serving')"><i class="fa-solid fa-play"></i></button>` : ''}
                            ${q.statusClass === 'status-serving' ? `<button class="btn-icon success" title="เสร็จสิ้น" onclick="updateQueueStatus(${q.id}, 'เสร็จสิ้น', 'status-done')"><i class="fa-solid fa-check"></i></button>` : ''}
                            ${q.statusClass !== 'status-done' ? `<button class="btn-icon danger" title="ยกเลิกคิว" onclick="deleteQueue(${q.id})"><i class="fa-solid fa-xmark"></i></button>` : ''}
                        </div>
                    </td>
                `;
                queueTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error fetching queues:', error);
            queueTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">ไม่สามารถโหลดข้อมูลคิวได้ กรุณาตรวจสอบการเชื่อมต่อกับเซิร์ฟเวอร์ (API ที่พอร์ต 3000)</td></tr>';
        }
    }

    // Assign globally to be called from onclick
    window.updateQueueStatus = async (id, status, statusClass) => {
        try {
            await fetch(`${API_URL}/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, statusClass })
            });
            fetchAndRenderQueue();
        } catch (error) {
            console.error('Error updating queue:', error);
        }
    };

    window.deleteQueue = async (id) => {
        if (confirm('คุณต้องการยกเลิกคิวนี้ใช่หรือไม่?')) {
            try {
                await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
                fetchAndRenderQueue();
            } catch (error) {
                console.error('Error deleting queue:', error);
            }
        }
    };

    /* --- 3.5 API Data Rendering (Dashboard Stats) --- */
    async function fetchAndRenderStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/stats`);
            const stats = await response.json();
            
            document.getElementById('stat-customers').innerHTML = `${stats.customersToday} <span class="trend positive"><i class="fa-solid fa-arrow-up"></i> 12%</span>`;
            document.getElementById('stat-revenue').innerHTML = `฿${stats.revenueToday.toLocaleString()} <span class="trend positive"><i class="fa-solid fa-arrow-up"></i> 8%</span>`;
            
            let waitTrend = stats.queueWaiting > 5 ? 'negative' : 'positive';
            let waitIcon = stats.queueWaiting > 5 ? 'fa-arrow-up' : 'fa-arrow-down';
            document.getElementById('stat-waiting').innerHTML = `${stats.queueWaiting} <span class="trend ${waitTrend}"><i class="fa-solid ${waitIcon}"></i> รอเฉลี่ย 15 นาที</span>`;
            
            let staffTrend = (stats.staffTotal - stats.staffWorking) > 0 ? `ว่าง ${stats.staffTotal - stats.staffWorking} คน` : 'เต็มทุกคิว';
            document.getElementById('stat-staff').innerHTML = `${stats.staffWorking}/${stats.staffTotal} <span class="trend">${staffTrend}</span>`;
            
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    }

    // Initial fetch and poll every 5 seconds for real-time updates (Queue only)
    fetchAndRenderQueue();
    fetchAndRenderStats();
    setInterval(() => {
        if (document.getElementById('view-dashboard').classList.contains('active')) {
            fetchAndRenderQueue();
            fetchAndRenderStats();
        }
    }, 5000);

    /* --- 3.6 Reports Rendering --- */
    window.reportsInitialized = false;
    async function fetchAndRenderReports() {
        if(window.reportsInitialized) return;

        try {
            const [revenueResponse, serviceResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/reports/revenue-week`),
                fetch(`${API_BASE_URL}/api/reports/services`)
            ]);

            const revenue = await revenueResponse.json();
            const service = await serviceResponse.json();

            const ctxRev = document.getElementById('revenueChart');
            if(ctxRev) {
                new Chart(ctxRev, {
                    type: 'line',
                    data: {
                        labels: revenue.labels || [],
                        datasets: [{
                            label: 'รายได้ (บาท)',
                            data: revenue.data || [],
                            borderColor: '#f59e0b',
                            tension: 0.3,
                            fill: true,
                            backgroundColor: 'rgba(245, 158, 11, 0.1)'
                        }]
                    },
                    options: { maintainAspectRatio: false }
                });
            }

            const ctxServ = document.getElementById('serviceChart');
            if(ctxServ) {
                new Chart(ctxServ, {
                    type: 'doughnut',
                    data: {
                        labels: service.labels || [],
                        datasets: [{
                            data: service.data || [],
                            backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#6366f1', '#ec4899', '#84cc16']
                        }]
                    },
                    options: { maintainAspectRatio: false }
                });
            }
            window.reportsInitialized = true;
        } catch (error) {
            console.error('Error fetching reports:', error);
        }
    }

    /* --- 4. Customers rendering --- */
    window.globalCustomers = [];
    window.globalStaff = [];
    window.globalServices = [];
    window.globalProducts = [];

    const customersTableBody = document.getElementById('customers-table-body');
    async function fetchAndRenderCustomers() {
        if(!customersTableBody) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/customers`);
            const customers = await response.json();
            window.globalCustomers = customers;
            customersTableBody.innerHTML = '';
            customers.forEach(c => {
                const tr = document.createElement('tr');
                let tierClass = 'text-muted';
                if(c.memberTier === 'Gold') tierClass = 'text-warning';
                else if(c.memberTier === 'Silver') tierClass = 'text-info';
                
                tr.innerHTML = `
                    <td>${c.code}</td>
                    <td>
                        <div class="flex-item">
                            <img src="https://ui-avatars.com/api/?name=${c.name.split(' ')[0]}&background=random&color=fff" class="avatar-sm" alt="${c.name}">
                            <span>${c.name}</span>
                        </div>
                    </td>
                    <td>${c.phone}</td>
                    <td>${c.joinDate}</td>
                    <td><b class="${tierClass}">${c.memberTier}</b></td>
                    <td>${c.points}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon accent" title="แก้ไข" onclick="editCustomer(${c.id})"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn-icon danger" title="ลบ" onclick="deleteCustomer(${c.id})"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                `;
                customersTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error fetching customers:', error);
            customersTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">ไม่สามารถโหลดข้อมูลได้</td></tr>';
        }
    }

    window.deleteCustomer = async (id) => {
        if (confirm('คุณต้องการลบลูกค้านี้ใช่หรือไม่?')) {
            try {
                await fetch(`${API_BASE_URL}/api/customers/${id}`, { method: 'DELETE' });
                fetchAndRenderCustomers();
            } catch (error) {
                console.error('Error deleting customer:', error);
            }
        }
    };

    /* --- 5. Staff rendering --- */
    const staffGrid = document.getElementById('staff-grid');
    async function fetchAndRenderStaff() {
        if(!staffGrid) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/staff`);
            const staffList = await response.json();
            window.globalStaff = staffList;
            staffGrid.innerHTML = '';
            
            staffList.forEach(s => {
                const div = document.createElement('div');
                div.className = 'stat-card glass-panel';
                div.style.flexDirection = 'column';
                div.style.alignItems = 'center';
                div.style.textAlign = 'center';
                
                let statusBadge = '';
                if(s.status === 'ทำงาน') statusBadge = '<span class="status-badge status-serving">ทำงาน</span>';
                else if(s.status === 'พักเบรค') statusBadge = '<span class="status-badge status-waiting">พักเบรค</span>';
                else statusBadge = '<span class="status-badge status-done">ไม่ว่าง</span>';
                
                div.innerHTML = `
                    <div style="margin-bottom: 1rem;">
                        <img src="https://ui-avatars.com/api/?name=${s.nickname}&background=random&color=fff" class="avatar" style="width: 80px; height: 80px;" alt="${s.name}">
                    </div>
                    <div class="stat-content" style="width: 100%;">
                        <h3 style="margin-bottom: 0.5rem; font-size: 1.2rem;">${s.name} (${s.nickname})</h3>
                        <p class="text-accent">${s.role}</p>
                        <p class="text-muted" style="font-size: 0.9rem; margin-top: 0.5rem;"><i class="fa-solid fa-briefcase"></i> ประสบการณ์: ${s.experience}</p>
                        <div style="margin-top: 1rem;">${statusBadge}</div>
                        <button class="btn btn-outline" style="margin-top: 15px; width: 100%;" onclick="editStaff(${s.id})">แก้ไขข้อมูล</button>
                    </div>
                `;
                staffGrid.appendChild(div);
            });
        } catch (error) {
            console.error('Error fetching staff:', error);
            staffGrid.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">ไม่สามารถโหลดข้อมูลได้</p>';
        }
    }

    /* --- 6. Services rendering --- */
    const servicesTableBody = document.getElementById('services-table-body');
    async function fetchAndRenderServices() {
        if(!servicesTableBody) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/services`);
            const services = await response.json();
            window.globalServices = services;
            servicesTableBody.innerHTML = '';
            
            services.forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><span class="badge" style="background: rgba(245, 158, 11, 0.2); color: var(--accent); padding: 5px 10px; border-radius: 20px;">${s.category}</span></td>
                    <td style="font-weight: 500;">${s.name}</td>
                    <td><i class="fa-regular fa-clock text-muted"></i> ${s.duration}</td>
                    <td style="color: var(--success); font-weight: bold;">฿${s.price.toLocaleString()}</td>
                    <td>
                        <button class="btn-icon accent" title="แก้ไข" onclick="editService(${s.id})"><i class="fa-solid fa-pen"></i></button>
                    </td>
                `;
                servicesTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error fetching services:', error);
            servicesTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">ไม่สามารถโหลดข้อมูลได้</td></tr>';
        }
    }

    /* --- 7. Products & POS rendering --- */
    const productsTableBody = document.getElementById('products-table-body');
    async function fetchAndRenderProducts() {
        if(!productsTableBody) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/products`);
            const products = await response.json();
            window.globalProducts = products;
            productsTableBody.innerHTML = '';
            products.forEach(p => {
                const tr = document.createElement('tr');
                let stockClass = p.stock > 10 ? 'text-success' : (p.stock > 0 ? 'text-warning' : 'text-danger');
                tr.innerHTML = `
                    <td>${p.code}</td>
                    <td style="font-weight: 500;">${p.name}</td>
                    <td>${p.category}</td>
                    <td style="color: var(--accent); font-weight: bold;">฿${p.price.toLocaleString()}</td>
                    <td class="${stockClass}" style="font-weight: bold;">${p.stock} ${p.unit}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-icon accent" title="แก้ไข" onclick="editProduct(${p.id})"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn-icon danger" title="ลบ" onclick="deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                `;
                productsTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error fetching products:', error);
            productsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">ไม่สามารถโหลดข้อมูลได้</td></tr>';
        }
    }

    window.deleteProduct = async (id) => {
        if (confirm('คุณต้องการลบสินค้านี้ใช่หรือไม่?')) {
            try {
                await fetch(`${API_BASE_URL}/api/products/${id}`, { method: 'DELETE' });
                fetchAndRenderProducts();
            } catch (error) {
                console.error('Error deleting product:', error);
            }
        }
    };

    const posTableBody = document.getElementById('pos-table-body');
    async function fetchAndRenderPOS() {
        if(!posTableBody) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/orders`);
            const orders = await response.json();
            posTableBody.innerHTML = '';
            orders.forEach(o => {
                const tr = document.createElement('tr');
                const dateObj = new Date(o.orderDate);
                const dateStr = dateObj.toLocaleDateString('th-TH') + ' ' + dateObj.toLocaleTimeString('th-TH').slice(0, 5);
                
                tr.innerHTML = `
                    <td style="font-weight: 500; color: var(--accent);">${o.billNo}</td>
                    <td>${o.customerName}</td>
                    <td style="color: var(--success); font-weight: bold;">฿${o.totalAmount.toLocaleString()}</td>
                    <td>${o.paymentMethod}</td>
                    <td class="text-muted"><i class="fa-regular fa-clock"></i> ${dateStr}</td>
                `;
                posTableBody.appendChild(tr);
            });
        } catch (error) {
            console.error('Error fetching orders:', error);
            posTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">ไม่สามารถโหลดข้อมูลได้</td></tr>';
        }
    }

    /* --- 7. Modal Handlers & Form Submissions --- */
    window.openModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            // reset form if inside this modal
            const form = modal.querySelector('form');
            if(form) form.reset();
        }
    };

    window.closeModal = (modalId) => {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    };

    // Close on click outside
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('active');
        }
    };

    // Helper functions for Edit Modes
    window.editCustomer = (id) => {
        const c = window.globalCustomers.find(x => x.id === id);
        if(c) {
            document.getElementById('cust-id').value = c.id;
            document.getElementById('cust-name').value = c.name;
            document.getElementById('cust-phone').value = c.phone;
            document.getElementById('cust-email').value = c.email || '';
            document.getElementById('cust-tier').value = c.memberTier || 'Bronze';
            openModal('modal-customer');
        }
    };

    window.editStaff = (id) => {
        const s = window.globalStaff.find(x => x.id === id);
        if(s) {
            document.getElementById('staff-id').value = s.id;
            document.getElementById('staff-name').value = s.name;
            document.getElementById('staff-nickname').value = s.nickname;
            document.getElementById('staff-exp').value = s.experience || '';
            document.getElementById('staff-role').value = s.role;
            openModal('modal-staff');
        }
    };

    window.editService = (id) => {
        const s = window.globalServices.find(x => x.id === id);
        if(s) {
            document.getElementById('serv-id').value = s.id;
            document.getElementById('serv-name').value = s.name;
            document.getElementById('serv-cat').value = s.category;
            document.getElementById('serv-price').value = s.price;
            document.getElementById('serv-duration').value = s.duration || '';
            openModal('modal-service');
        }
    };

    window.editProduct = (id) => {
        const p = window.globalProducts.find(x => x.id === id);
        if(p) {
            document.getElementById('prod-id').value = p.id;
            document.getElementById('prod-name').value = p.name;
            document.getElementById('prod-cat').value = p.category;
            document.getElementById('prod-price').value = p.price;
            document.getElementById('prod-stock').value = p.stock;
            document.getElementById('prod-unit').value = p.unit || 'ชิ้น';
            openModal('modal-product');
        }
    };

    // Submit Customer Form
    const formCustomer = document.getElementById('form-customer');
    if(formCustomer) {
        formCustomer.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('cust-id').value;
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_BASE_URL}/api/customers/${id}` : `${API_BASE_URL}/api/customers`;
            
            const data = {
                name: document.getElementById('cust-name').value,
                phone: document.getElementById('cust-phone').value,
                memberTier: document.getElementById('cust-tier').value,
                email: document.getElementById('cust-email').value,
            };
            try {
                await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                closeModal('modal-customer');
                if (document.getElementById('view-customers').classList.contains('active')) {
                    fetchAndRenderCustomers();
                } else {
                    alert('บันทึกข้อมูลลูกค้าสำเร็จ!');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            }
        });
    }

    // Submit Staff Form
    const formStaff = document.getElementById('form-staff');
    if(formStaff) {
        formStaff.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('staff-id').value;
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_BASE_URL}/api/staff/${id}` : `${API_BASE_URL}/api/staff`;
            
            const data = {
                name: document.getElementById('staff-name').value,
                nickname: document.getElementById('staff-nickname').value,
                role: document.getElementById('staff-role').value,
                experience: document.getElementById('staff-exp').value
            };
            try {
                await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                closeModal('modal-staff');
                if (document.getElementById('view-staff').classList.contains('active')) {
                    fetchAndRenderStaff();
                } else {
                    alert('บันทึกข้อมูลช่างสำเร็จ!');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            }
        });
    }

    // Submit Service Form
    const formService = document.getElementById('form-service');
    if(formService) {
        formService.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('serv-id').value;
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_BASE_URL}/api/services/${id}` : `${API_BASE_URL}/api/services`;
            
            const data = {
                name: document.getElementById('serv-name').value,
                category: document.getElementById('serv-cat').value,
                price: parseFloat(document.getElementById('serv-price').value),
                duration: document.getElementById('serv-duration').value || '30 นาที'
            };
            try {
                await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                closeModal('modal-service');
                if (document.getElementById('view-services').classList.contains('active')) {
                    fetchAndRenderServices();
                } else {
                    alert('บันทึกข้อมูลบริการสำเร็จ!');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            }
        });
    }

    // Submit Product Form
    const formProduct = document.getElementById('form-product');
    if(formProduct) {
        formProduct.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('prod-id').value;
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_BASE_URL}/api/products/${id}` : `${API_BASE_URL}/api/products`;
            
            const data = {
                name: document.getElementById('prod-name').value,
                category: document.getElementById('prod-cat').value,
                price: parseFloat(document.getElementById('prod-price').value),
                stock: parseInt(document.getElementById('prod-stock').value),
                unit: document.getElementById('prod-unit').value || 'ชิ้น'
            };
            try {
                await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                closeModal('modal-product');
                if (document.getElementById('view-products').classList.contains('active')) {
                    fetchAndRenderProducts();
                } else {
                    alert('บันทึกข้อมูลสินค้าสำเร็จ!');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            }
        });
    }

    // Submit POS Form
    const formPOS = document.getElementById('form-pos');
    if(formPOS) {
        formPOS.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                customerName: document.getElementById('pos-customer').value || 'ลูกค้าทั่วไป',
                totalAmount: parseFloat(document.getElementById('pos-total').value),
                paymentMethod: document.getElementById('pos-payment').value
            };
            try {
                await fetch(`${API_BASE_URL}/api/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                closeModal('modal-pos');
                if (document.getElementById('view-pos').classList.contains('active')) {
                    fetchAndRenderPOS();
                } else {
                    alert('ออกบิลชำระเงินสำเร็จ!');
                }
                
                // Optional: redirect to dashboard to re-render charts here
                
            } catch (error) {
                console.error('Error:', error);
                alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            }
        });
    }
});
