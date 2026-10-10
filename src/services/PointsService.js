import { db } from '../firebase';
import { doc, collection, addDoc, updateDoc, increment, serverTimestamp, getDoc } from 'firebase/firestore';

export const PointsService = {
    awardPoints: async (uid, action, generatorId = null) => {
        if (!uid) return;

        let pointsToAward;
        switch (action) {
            case 'export': pointsToAward = 10; break;
            case 'share_make': pointsToAward = 50; break;
            case 'daily_bonus': pointsToAward = 5; break;
            case 'first_try': pointsToAward = 20; break;
            case 'referral': pointsToAward = 100; break;
            default: return;
        }

        try {
            // 1. Update total points in user doc
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                points: increment(pointsToAward),
                totalExports: action === 'export' ? increment(1) : increment(0)
            });

            // 2. Add history entry
            const historyRef = collection(userRef, 'pointHistory');
            await addDoc(historyRef, {
                action,
                points: pointsToAward,
                generatorId,
                createdAt: serverTimestamp()
            });

            // 3. Check for tier upgrade
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const data = userSnap.data();
                const newTier = PointsService.calculateTier(data.points);
                if (newTier !== data.makerTier) {
                    await updateDoc(userRef, { makerTier: newTier });
                }
            }

        } catch (error) {
            console.error('Error awarding points:', error);
        }
    },

    calculateTier: (points) => {
        if (points >= 10000) return 'legend';
        if (points >= 2000) return 'master_maker';
        if (points >= 500) return 'pro_maker';
        return 'maker';
    },

    getExportsAllowed: (tier) => {
        switch (tier) {
            case 'legend': return Infinity;
            case 'master_maker': return 15;
            case 'pro_maker': return 10;
            case 'maker':
            default: return 5;
        }
    }
};
