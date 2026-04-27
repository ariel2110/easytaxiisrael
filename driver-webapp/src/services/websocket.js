export class RideWebSocket {
    constructor(rideId, role) {
        this.rideId = rideId;
        this.role = role;
        this.ws = null;
        this.callbacks = [];
        this.reconnectTimer = null;
        this.closed = false;
    }
    connect() {
        if (this.ws?.readyState === WebSocket.OPEN)
            return;
        const token = localStorage.getItem('access_token') ?? '';
        const url = `/ws/rides/${this.rideId}/${this.role}?token=${token}`;
        this.ws = new WebSocket(url);
        this.ws.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                this.callbacks.forEach((cb) => cb(data));
            }
            catch {
                // non-JSON control frame — ignore
            }
        };
        this.ws.onclose = () => {
            if (!this.closed) {
                this.reconnectTimer = setTimeout(() => this.connect(), 3000);
            }
        };
    }
    onLocation(cb) {
        this.callbacks.push(cb);
        return () => {
            this.callbacks = this.callbacks.filter((x) => x !== cb);
        };
    }
    send(payload) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        }
    }
    disconnect() {
        this.closed = true;
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.ws?.close();
        this.ws = null;
    }
}
