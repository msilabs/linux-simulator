---
title: path: /, ~, .. আর দুই রকম ঠিকানা
order: 3
summary: ফাইলের ঠিকানা লেখার নিয়ম, absolute আর relative path।
---

ফাইলের ঠিকানাকে বলে **path**। Linux-এ সব ফাইল একটা গাছের মতো সাজানো, যার গোড়া হলো `/`। Windows-এর মতো `C:` বা `D:` নেই।

```
/
├── etc/       system-এর setting
├── home/
│   └── dev/   আপনার home (~)
├── root/      root user-এর home
├── tmp/       অস্থায়ী ফাইল
└── var/
    └── log/   log ফাইল
```

## absolute path

`/` দিয়ে শুরু হলে সেটা **absolute** path। গোড়া থেকে পুরো ঠিকানা, তাই আপনি যেখানেই থাকুন একই জায়গা বোঝায়। যেমন `/var/log/nginx`।

## relative path

`/` ছাড়া শুরু হলে সেটা **relative** path, মানে এখনকার ফোল্ডার থেকে হিসাব। `~`-এ থাকলে `projects/my-site` মানে `/home/dev/projects/my-site`।

## বিশেষ চিহ্ন

| চিহ্ন | মানে |
| --- | --- |
| `/` | গোড়া |
| `~` | নিজের home (`/home/dev`) |
| `.` | এখনকার ফোল্ডার |
| `..` | এক ধাপ উপরের ফোল্ডার |

নিচে একই জায়গায় দুইভাবে যাওয়া দেখানো আছে। শেষে `cd ../..` দুই ধাপ উপরে তোলে।

```terminal
$ cd /var/log/nginx
$ pwd
$ cd ~/projects
$ pwd
$ cd ../..
$ pwd
```

নিজে চেষ্টা করুন: `ls /etc` দিয়ে যেকোনো জায়গা থেকে `/etc`-এর ভেতর দেখুন, তারপর `cat /etc/hosts` দিয়ে একটা ফাইল পড়ুন।

## ভুল path

ভুল ঠিকানা দিলে `No such file or directory` আসে। বানান আর বড়-ছোট হাতের অক্ষর দেখুন: Linux-এ `Projects` আর `projects` আলাদা।

```terminal
$ cd Projects   # বড় হাতের P, তাই পাবে না
```
