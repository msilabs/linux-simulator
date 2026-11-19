---
title: process: ps, kill আর Ctrl+C
order: 15
summary: কী কী চলছে দেখা, আর আটকে যাওয়া program থামানো।
---

চলতে থাকা প্রতিটা program একটা **process**। প্রতিটার একটা নম্বর থাকে, যাকে বলে **PID**।

## ps: কী চলছে

- `ps`: এই terminal-এর process।
- `ps aux`: সব user-এর সব process, CPU আর memory-র হিসাবসহ।

```terminal
$ ps aux
```

`node server.js` (PID 2301) প্রায় ৯৭% CPU খাচ্ছে। এটা আটকে গেছে।

## grep দিয়ে ছাঁকা

তালিকা লম্বা হলে pipe দিয়ে শুধু দরকারিটা:

```terminal
$ ps aux | grep node
```

## kill: থামতে বলা

`kill PID` process-কে থামার signal পাঠায় (SIGTERM)। ভালো program এতে গুছিয়ে বন্ধ হয়। কিন্তু আটকে থাকা program হয়তো শোনে না।

`kill -9 PID` (SIGKILL) জোর করে মেরে ফেলে, program কিছু গোছানোর সুযোগ পায় না। তাই এটা শেষ উপায়।

```terminal
$ kill 2301
$ ps aux | grep node
$ kill -9 2301
$ ps aux | grep node   # কিছু মিলবে না, server আর নেই
```

প্রথম `kill`-এর পরেও server চলছিল। `-9` দেওয়ার পরে নেই।

## Ctrl+C: সামনের program থামানো

`tail -f` বা `sleep`-এর মতো program নিজে শেষ হয় না, terminal আটকে রাখে। **Ctrl+C** সামনে চলা program-কে থামায়।

নিজে চেষ্টা করুন: `sleep 100` চালান, তারপর Ctrl+C বা নিচের বোতাম দিয়ে থামান।

```terminal
$ ps
```
