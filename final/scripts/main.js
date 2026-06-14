import { initNavigation } from './navigation.js';
import { runDataFetchWorkflow } from './data-fetch.js';
import { initStorageAndModal } from './storage-modal.js';

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    runDataFetchWorkflow();
    initStorageAndModal();
});