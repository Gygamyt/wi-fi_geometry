export type NetworkObservation = {
    ssid: string;
    bssid: string;
    signalQualityPercent: number | null;
    bandGHz: number | null;
    channel: number | null;
    radioType: string | null;
};

