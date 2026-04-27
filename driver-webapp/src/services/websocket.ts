import type { LocationPayload } from '../types'

type LocationCallback = (payload: LocationPayload) => void

export class RideWebSocket {
  private ws: WebSocket | null = null
  private callbacks: LocationCallback[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private closed = false

  constructor(
    private readonly rideId: string,
    private readonly role: 'driver' | 'passenger'
  ) {}

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return
    const token = localStorage.getItem('access_token') ?? ''
    const url = `/ws/rides/${this.rideId}/${this.role}?token=${token}`
    this.ws = new WebSocket(url)

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as LocationPayload
        this.callbacks.forEach((cb) => cb(data))
      } catch {
        // non-JSON control frame — ignore
      }
    }

    this.ws.onclose = () => {
      if (!this.closed) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000)
      }
    }
  }

  onLocation(cb: LocationCallback): () => void {
    this.callbacks.push(cb)
    return () => {
      this.callbacks = this.callbacks.filter((x) => x !== cb)
    }
  }

  send(payload: LocationPayload): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  disconnect(): void {
    this.closed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }
}
