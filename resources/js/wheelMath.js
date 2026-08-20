export function calculateWheelRotation(currentRotation, segmentIndex, segmentCount, fullTurns = 6) {
    const safeCount = Math.max(1, Number(segmentCount) || 1);
    const segmentAngle = 360 / safeCount;
    const segmentCenter = Number(segmentIndex || 0) * segmentAngle + segmentAngle / 2;
    const desiredRotation = (360 - segmentCenter) % 360;
    const currentNormalized = ((Number(currentRotation) || 0) % 360 + 360) % 360;
    const alignmentDelta = (desiredRotation - currentNormalized + 360) % 360;

    return (Number(currentRotation) || 0) + Math.max(1, fullTurns) * 360 + alignmentDelta;
}
