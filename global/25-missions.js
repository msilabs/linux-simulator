// mission আর তাদের ধাপ। ধাপ পূর্ণ হয় ফল দেখে, হুবহু লেখা মিলিয়ে নয়।
// অগ্রগতি একটা সংখ্যা: সব mission-এর ধাপ পরপর সাজালে কয়টা শেষ হয়েছে।
// mission-এর লেখা বা ক্রম বদলাতে শুধু এই ফাইল বদলান। নতুন ধাপ শুধু শেষে যোগ করুন, নাহলে পুরোনো সেভের অগ্রগতি অন্য ধাপে চলে যাবে।
(function (root) {
    // Stage: { label, check(ctx), command? }; ctx = { prev, next, command, ok, stdout }
    var MISSIONS = [];

    function totalSteps() {
        return MISSIONS.reduce(function (sum, m) { return sum + m.stages.length; }, 0);
    }

    // step নম্বর থেকে এখনকার mission আর তার ভেতরের ধাপ
    function missionAt(step) {
        var left = step;
        for (var i = 0; i < MISSIONS.length; i++) {
            if (left < MISSIONS[i].stages.length) return { index: i, stage: left };
            left -= MISSIONS[i].stages.length;
        }
        return { index: MISSIONS.length, stage: 0 };
    }

    function currentStage(step) {
        var at = missionAt(step);
        var mission = MISSIONS[at.index];
        return mission ? mission.stages[at.stage] : null;
    }

    // একটা command চলার পরে অগ্রগতি এক ধাপ এগোয় কিনা
    function nextStep(step, ctx) {
        var stage = currentStage(step);
        if (stage && stage.check(ctx)) return step + 1;
        return step;
    }

    var api = { MISSIONS: MISSIONS, totalSteps: totalSteps, missionAt: missionAt, currentStage: currentStage, nextStep: nextStep };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.LinuxMissions = api;
})(typeof self !== 'undefined' ? self : this);
