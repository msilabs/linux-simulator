# Linux Simulator

ব্রাউজারে নকল Linux terminal। `cd`, `ls`, `grep`, `chmod` আর pipe নিজের হাতে চালান, প্রতিটা command-এর বাংলা ব্যাখ্যা পান। কিছু install করতে হয় না, ভুল করলে Undo আছে, আপনার লেখা কোথাও পাঠানো হয় না।

🔗 **লাইভ:** https://msilabs.github.io/linux-simulator/

> কাজ চলছে। অবস্থা আর পরিকল্পনা: `plans/linux-simulator-plan.md` (msilabs-এর পরিকল্পনা ফোল্ডারে)।

## চালানো

সাইট বানানো হয় [আলো (Alo)](https://github.com/msilabs/alo) দিয়ে। Node.js ২২ বা নতুন ভার্সন লাগবে।

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # dist/ ফোল্ডারে সাইট
npm test        # engine আর mission-এর test
```

GitHub Pages-এর মতো সাব-পাথের জন্য: `node alo build --base /linux-simulator/`

## লাইসেন্স

MIT। [msilabs](https://msilabs.github.io)-এর অংশ।
