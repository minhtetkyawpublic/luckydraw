function positiveNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

export function calculateWheelEconomics(segments = [], packages = []) {
    const totalWeight = segments.reduce((sum, segment) => sum + positiveNumber(segment.weight), 0);

    if (totalWeight <= 0) {
        return {
            status: 'incomplete',
            expectedPoints: 0,
            expectedExtraSpins: 0,
            effectiveExpectedPoints: 0,
            packageResults: [],
            worstPackage: null,
        };
    }

    let expectedPoints = 0;
    let expectedExtraSpins = 0;

    segments.forEach((segment) => {
        const chance = positiveNumber(segment.weight) / totalWeight;
        const rewardType = segment.reward_type || 'points';
        const rewardAmount = positiveNumber(
            rewardType === 'spins'
                ? (segment.spins_reward ?? segment.reward_amount)
                : (segment.points_reward ?? segment.reward_amount),
        );

        if (rewardType === 'spins') {
            expectedExtraSpins += chance * rewardAmount;
        } else {
            expectedPoints += chance * rewardAmount;
        }
    });

    const unstable = expectedExtraSpins >= 1;
    const effectiveExpectedPoints = unstable
        ? Number.POSITIVE_INFINITY
        : expectedPoints / (1 - expectedExtraSpins);

    const packageResults = packages.map((item) => {
        const pointsCost = positiveNumber(item.points_cost);
        const spinsAmount = positiveNumber(item.spins_amount);
        const eligible = Boolean(item.is_active) && pointsCost > 0 && spinsAmount > 0;
        const pointsPerSpin = spinsAmount > 0 ? pointsCost / spinsAmount : 0;
        const playerReturnPer100 = eligible && !unstable && pointsPerSpin > 0
            ? (effectiveExpectedPoints / pointsPerSpin) * 100
            : (unstable && eligible ? Number.POSITIVE_INFINITY : 0);

        return {
            eligible,
            pointsPerSpin,
            playerReturnPer100,
            adminKeepsPer100: eligible ? 100 - playerReturnPer100 : 0,
        };
    });

    const activeResults = packageResults.filter((result) => result.eligible);
    const worstPackage = activeResults.reduce((worst, result) => (
        !worst || result.playerReturnPer100 > worst.playerReturnPer100 ? result : worst
    ), null);

    let status = 'incomplete';
    if (unstable && activeResults.length > 0) {
        status = 'unstable';
    } else if (worstPackage) {
        if (worstPackage.playerReturnPer100 > 100) status = 'loss';
        else if (worstPackage.playerReturnPer100 >= 85) status = 'caution';
        else status = 'safe';
    }

    return {
        status,
        expectedPoints,
        expectedExtraSpins,
        effectiveExpectedPoints,
        packageResults,
        worstPackage,
    };
}
