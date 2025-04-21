export interface Keypoint {
    x: number;
    y: number;
    z?: number;
}

export interface FaceLandmarks {
    keypoints: Keypoint[];
    faceOval: Array<{
        x: number;
        y: number;
    }>;
    leftEye: Array<{
        x: number;
        y: number;
    }>;
    rightEye: Array<{
        x: number;
        y: number;
    }>;
    mouth: Array<{
        x: number;
        y: number;
    }>;
}

export interface AvatarState {
    expression: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised';
    eyeBlink: {
        left: number;
        right: number;
    };
    mouthOpen: number;
    headRotation: {
        x: number;
        y: number;
        z: number;
    };
}
