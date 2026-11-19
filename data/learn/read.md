---
title: পড়া: cat, head, tail, wc
order: 5
summary: পুরো ফাইল, শুধু শুরু বা শেষ দেখা, আর লাইন গোনা।
---

## cat: পুরো ফাইল

`cat notes.txt` পুরো ফাইলটা পর্দায় দেখায়। ছোট ফাইলের জন্য ভালো। `-n` দিলে লাইন নম্বরসহ।

```terminal
$ cat notes.txt
$ cat -n notes.txt
```

## head আর tail: শুরু আর শেষ

server-এর log ফাইলে হাজার হাজার লাইন থাকে। পুরোটা `cat` করলে পর্দা ভরে যায়। তখন:

- `head -n 5 ফাইল`: প্রথম ৫ লাইন।
- `tail -n 5 ফাইল`: শেষ ৫ লাইন। log-এ নতুন লেখা শেষে যোগ হয়, তাই `tail` বেশি কাজে লাগে।

`-n` না দিলে ১০ লাইন ধরে নেয়।

```terminal
$ head -n 3 /var/log/nginx/access.log
$ tail -n 3 /var/log/nginx/error.log
```

## wc: গোনা

`wc -l` লাইন গোনে, `-w` শব্দ, `-c` byte। log-এ কয়টা request এসেছে জানতে `wc -l` যথেষ্ট, কারণ প্রতি লাইনে একটা request।

```terminal
$ wc -l /var/log/nginx/access.log
$ wc -l notes.txt
```

## tail -f: চলতে থাকা log দেখা

`tail -f ফাইল` শেষ লাইনগুলো দেখিয়ে অপেক্ষা করে, নতুন লাইন এলে সাথে সাথে দেখায়। নিজে থেকে শেষ হয় না, বের হতে **Ctrl+C** চাপতে হয়।

নিজে চেষ্টা করুন: `tail -f /var/log/nginx/error.log` চালান, তারপর Ctrl+C বা নিচের বোতাম দিয়ে থামান।

```terminal
$ ls /var/log/nginx
```

`less` বড় ফাইল পাতা পাতা করে পড়ায়। এই simulator-এ সেটা `cat`-এর মতোই পুরোটা একবারে দেখায়।
