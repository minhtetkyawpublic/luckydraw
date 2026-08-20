import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateWheelRotation } from '../../resources/js/wheelMath.js';

function normalized(value) {
    return ((value % 360) + 360) % 360;
}

test('wheel aligns every server-selected segment on repeated spins', () => {
    const segmentCount = 4;
    let rotation = 0;

    for (const selectedIndex of [0, 2, 1, 3, 0, 3]) {
        const previous = rotation;
        rotation = calculateWheelRotation(rotation, selectedIndex, segmentCount, 6);
        const segmentCenter = selectedIndex * (360 / segmentCount) + (360 / segmentCount) / 2;
        const expected = normalized(360 - segmentCenter);

        assert.equal(normalized(rotation), expected);
        assert.ok(rotation - previous >= 6 * 360);
    }
});

test('wheel calculation works with non-even segment counts', () => {
    const rotation = calculateWheelRotation(2475, 4, 7, 6);
    const segmentCenter = 4 * (360 / 7) + (360 / 7) / 2;

    assert.ok(Math.abs(normalized(rotation) - normalized(360 - segmentCenter)) < 0.000001);
});
