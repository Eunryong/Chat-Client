import { AvatarState } from '../types/face';

export const renderAvatar = (canvas: HTMLCanvasElement, state: AvatarState): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 아바타 기본 설정
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.4;

    // 얼굴 기본형
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#FFE4C4';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 눈 렌더링
    const eyeRadius = radius * 0.1;
    const eyeOffsetX = radius * 0.3;
    const eyeOffsetY = radius * 0.2;

    // 왼쪽 눈
    ctx.beginPath();
    ctx.arc(centerX - eyeOffsetX, centerY - eyeOffsetY, eyeRadius * (1 - state.eyeBlink.left), 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // 오른쪽 눈
    ctx.beginPath();
    ctx.arc(centerX + eyeOffsetX, centerY - eyeOffsetY, eyeRadius * (1 - state.eyeBlink.right), 0, Math.PI * 2);
    ctx.fillStyle = '#000000';
    ctx.fill();

    // 입 렌더링
    const mouthWidth = radius * 0.6;
    const mouthHeight = radius * 0.3 * state.mouthOpen;
    const mouthY = centerY + radius * 0.3;

    ctx.beginPath();
    ctx.ellipse(centerX, mouthY, mouthWidth / 2, mouthHeight / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FF69B4';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 표정에 따른 추가 효과
    switch (state.expression) {
        case 'happy':
            // 미소 곡선
            ctx.beginPath();
            ctx.arc(centerX, mouthY + mouthHeight * 0.5, mouthWidth * 0.8, 0, Math.PI);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.stroke();
            break;
        case 'sad':
            // 찡그린 입
            ctx.beginPath();
            ctx.arc(centerX, mouthY - mouthHeight * 0.5, mouthWidth * 0.8, Math.PI, Math.PI * 2);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.stroke();
            break;
        case 'angry':
            // 찡그린 눈썹
            ctx.beginPath();
            ctx.moveTo(centerX - eyeOffsetX * 1.5, centerY - eyeOffsetY * 1.2);
            ctx.lineTo(centerX - eyeOffsetX * 0.5, centerY - eyeOffsetY * 1.5);
            ctx.moveTo(centerX + eyeOffsetX * 0.5, centerY - eyeOffsetY * 1.5);
            ctx.lineTo(centerX + eyeOffsetX * 1.5, centerY - eyeOffsetY * 1.2);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.stroke();
            break;
        case 'surprised':
            // 큰 눈
            ctx.beginPath();
            ctx.arc(centerX - eyeOffsetX, centerY - eyeOffsetY, eyeRadius * 1.2, 0, Math.PI * 2);
            ctx.arc(centerX + eyeOffsetX, centerY - eyeOffsetY, eyeRadius * 1.2, 0, Math.PI * 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.stroke();
            break;
    }
};
