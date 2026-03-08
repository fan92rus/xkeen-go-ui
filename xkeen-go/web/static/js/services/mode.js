// services/mode.js - Mode management API

import { get } from './api.js';

export async function getModeInfo() {
    return get('/api/config/mode');
}
