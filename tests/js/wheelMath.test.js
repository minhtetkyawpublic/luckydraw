import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateWheelRotation } from '../../resources/js/wheelMath.js';
import { calculateWheelEconomics } from '../../resources/js/wheelEconomics.js';

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

test('wheel safety includes future rewards from extra spins', () => {
    const result = calculateWheelEconomics([
        { reward_type: 'points', points_reward: 20, weight: 80 },
        { reward_type: 'spins', spins_reward: 1, weight: 20 },
    ], [
        { points_cost: 100, spins_amount: 4, is_active: true },
    ]);

    assert.equal(result.expectedPoints, 16);
    assert.equal(result.expectedExtraSpins, 0.2);
    assert.equal(result.effectiveExpectedPoints, 20);
    assert.equal(result.worstPackage.playerReturnPer100, 80);
    assert.equal(result.worstPackage.adminKeepsPer100, 20);
    assert.equal(result.status, 'safe');
});

test('wheel safety warns for loss and self-repeating spin rewards', () => {
    const loss = calculateWheelEconomics([
        { reward_type: 'points', points_reward: 50, weight: 100 },
    ], [{ points_cost: 100, spins_amount: 3, is_active: true }]);
    assert.equal(loss.status, 'loss');

    const unstable = calculateWheelEconomics([
        { reward_type: 'spins', spins_reward: 2, weight: 50 },
        { reward_type: 'points', points_reward: 10, weight: 50 },
    ], [{ points_cost: 100, spins_amount: 3, is_active: true }]);
    assert.equal(unstable.status, 'unstable');
    assert.equal(unstable.effectiveExpectedPoints, Number.POSITIVE_INFINITY);
});
