---
title: pipe দিয়ে জোড়া: |, sort, uniq, cut
order: 11
summary: এক command-এর ফলকে পরের command-এর ইনপুট বানানো।
---

`|` (pipe) বাঁ পাশের command-এর ফল সরাসরি ডান পাশের command-এ পাঠায়, মাঝে কোনো ফাইল লাগে না। ছোট ছোট command জুড়ে বড় কাজ করা Linux-এর মূল ধারণা।

```terminal
$ grep ERROR /var/log/nginx/error.log | wc -l
```

`grep` ERROR লাইনগুলো বের করল, `wc -l` সেগুলো গুনল। ব্যাখ্যার বাক্সে প্রতিটা ধাপ আলাদা করে দেখায়।

## সাজানো আর গোনার command

| command | কাজ |
| --- | --- |
| `sort` | লাইন সাজায়। `-n` সংখ্যা হিসেবে, `-r` উল্টো |
| `uniq` | পাশাপাশি একই লাইন এক করে। `-c` কয়বার এসেছে গোনে |
| `cut` | প্রতি লাইনের একটা অংশ কাটে। `-d' '` ভাগের চিহ্ন, `-f1` কোন অংশ |
| `head` / `tail` | প্রথম বা শেষ কয়েকটা |

`uniq` শুধু **পাশাপাশি** একই লাইন ধরে, তাই আগে `sort` করতে হয়।

## log থেকে উত্তর বের করা

access.log-এর প্রতি লাইনের প্রথম অংশ IP। কোন IP কতবার এসেছে:

```terminal
$ head -n 2 /var/log/nginx/access.log
$ cut -d' ' -f1 /var/log/nginx/access.log | sort | uniq -c | sort -rn
```

ধাপগুলো: `cut` IP কাটল → `sort` একই IP পাশাপাশি আনল → `uniq -c` গুনল → `sort -rn` বেশি থেকে কমে সাজাল।

একই নিয়মে status code (৯ নম্বর অংশ) গোনা:

```terminal
$ cut -d' ' -f9 /var/log/nginx/access.log | sort | uniq -c
```

নিজে চেষ্টা করুন: শুধু `500` হওয়া লাইনগুলোর IP গুনুন। শুরু হবে `grep " 500 "` দিয়ে।
