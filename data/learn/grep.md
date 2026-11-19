---
title: লেখার ভেতরে খোঁজা: grep
order: 9
summary: ফাইলের ভেতর থেকে নির্দিষ্ট লেখা আছে এমন লাইন বের করা।
---

`find` ফাইলের **নাম** খোঁজে, `grep` ফাইলের **ভেতরের লেখা** খোঁজে। যে লাইনে লেখাটা আছে, শুধু সেগুলো দেখায়।

```terminal
$ grep ERROR /var/log/nginx/error.log
```

## কাজের option

| option | কাজ |
| --- | --- |
| `-i` | বড়-ছোট হাতের অক্ষর এক ধরে |
| `-n` | লাইন নম্বর দেখায় |
| `-c` | লাইন না দেখিয়ে শুধু সংখ্যা দেয় |
| `-v` | উল্টো: যে লাইনে নেই সেগুলো |
| `-r` | ফোল্ডারের ভেতরের সব ফাইলে খোঁজে |
| `-l` | শুধু ফাইলের নাম দেখায় |

```terminal
$ grep -c ERROR /var/log/nginx/error.log
$ grep -v INFO /var/log/nginx/error.log
```

## পুরো প্রজেক্টে খোঁজা

কোন ফাইলে `console` লেখা আছে মনে নেই? `-rn` দিলে ফাইলের নাম আর লাইন নম্বরসহ দেখায়। VS Code-এর "Find in Files"-এর মতো।

```terminal
$ grep -rn console projects
$ grep -rl "<h1>" projects
```

## space থাকলে quote

খোঁজার লেখায় space থাকলে quote লাগে: `grep " 404 " access.log`। দুই পাশের space দিলে `404` শুধু status হিসেবে মেলে, অন্য সংখ্যার ভেতরে না।

নিজে চেষ্টা করুন: access.log-এ কয়টা `500` error হয়েছে `-c` দিয়ে বের করুন।
