export const getApiUrl = (endpoint) => {
    let host = import.meta.env.VITE_API_HOST_IP || '127.0.0.1';
    if (host === '0.0.0.0' && typeof window !== 'undefined') {
        host = window.location.hostname;
    }
    const port = import.meta.env.VITE_API_HOST_PORT || '8015';
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `http://${host}:${port}${path}`;
};
