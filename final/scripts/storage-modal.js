export function initStorageAndModal() {
    // Persistent LocalStorage Tracking
    const banner = document.getElementById('dashboard-metric-banner');
    if (banner) {
        let metricsCount = Number(localStorage.getItem('kfh-visit-logs')) || 0;
        metricsCount++;
        localStorage.setItem('kfh-visit-logs', metricsCount);
        banner.textContent = `Welcome back! You have synchronized with our health grid dashboard ${metricsCount} times.`;
    }

    // High Contrast Mode Persistence Settings
    const modeBtn = document.getElementById('contrast-mode-toggle');
    if (modeBtn) {
        if (localStorage.getItem('kfh-high-contrast') === 'true') {
            document.body.classList.add('high-contrast-mode');
        }
        modeBtn.addEventListener('click', () => {
            document.body.classList.toggle('high-contrast-mode');
            localStorage.setItem('kfh-high-contrast', document.body.classList.contains('high-contrast-mode'));
        });
    }

    // Modal Architecture Handlers
    const dialogElement = document.getElementById('trainer-details-dialog');
    const modalTitle = document.getElementById('modal-trainer-name');
    const modalBody = document.getElementById('modal-trainer-body');
    const closeBtn = document.getElementById('close-dialog-btn');

    if (dialogElement && closeBtn) {
        document.body.addEventListener('click', (event) => {
            if (event.target.classList.contains('view-profile-modal-btn')) {
                const targetBtn = event.target;
                modalTitle.textContent = targetBtn.getAttribute('data-name');
                modalBody.innerHTML = `
                    <p><strong>Primary Strategic Vector:</strong> ${targetBtn.getAttribute('data-focus')}</p>
                    <p><strong>Accreditation Body Matrix:</strong> ${targetBtn.getAttribute('data-cert')}</p>
                    <p style="margin-top: 1rem; font-size: 0.9rem; color: #555;">Booking slots are currently open at our centrally coordinated facilities within Kampala. Present this application slip code [KFH-NODE-${targetBtn.getAttribute('data-id')}] at reception.</p>
                `;
                dialogElement.showModal();
            }
        });

        closeBtn.addEventListener('click', () => {
            dialogElement.close();
        });
    }
}