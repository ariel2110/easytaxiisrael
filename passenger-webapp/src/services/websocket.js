export class RideWebSocket {
    constructor(rideId) {
        this.rideId = rideId;
        this.ws = null;
        this.callbacks = [];
        this.reconnectTimer = null;
        this.closed = false;
    }
    connect() {
        const token = localStorage.getItem('access_token') ?? '';
        this.ws = new WebSocket(`/ws/rides/${this.rideId}/passenger?token=${token}`);
        this.ws.onmessage = (e) => {
            try {
                const d = JSON.parse(e.data);
                this.callbacks.forEach(cb => cb(d));
            }
            catch { /* ignore */ }
        };
        this.ws.onclose = () => {
            if (!this.closed)
                this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        };
    }
    onLocation(cb) {
        this.callbacks.push(cb);
        return () => { this.callbacks = this.callbacks.filter(x => x !== cb); };
    }
    disconnect() {
        this.closed = true;
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.ws?.close();
    }
}
