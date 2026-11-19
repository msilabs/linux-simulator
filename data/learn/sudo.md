---
title: user, root আর sudo
order: 14
summary: কে হিসেবে চলছেন, root কেন বিপজ্জনক, আর sudo কী করে।
---

Linux-এ অনেক user থাকে। প্রতিটা ফাইলের একজন মালিক থাকে, আর অধিকার ঠিক হয় সেই অনুযায়ী।

```terminal
$ whoami
$ id
$ cat /etc/passwd
```

`id`-এ `27(sudo)` দেখুন। এর মানে `dev` এমন দলে আছে যারা `sudo` চালাতে পারে।

## root

**root** হলো সব ক্ষমতার user। কোনো অধিকার root-কে আটকায় না: সে যেকোনো ফাইল পড়তে, বদলাতে, মুছতে পারে। তাই রোজকার কাজে root হিসেবে থাকা হয় না।

`/root` ফোল্ডারে (root-এর home) সাধারণ user ঢুকতে পারে না:

```terminal
$ ls /root   # অধিকার নেই
```

## sudo: একবারের জন্য root

`sudo command` শুধু ওই একটা command root হিসেবে চালায়। আসল Linux-এ এতে নিজের password চায়।

```terminal
$ sudo whoami
$ sudo ls -la /root
```

## chown: মালিক বদলানো

`chown নতুন-মালিক ফাইল` মালিক বদলায়। এটা শুধু root পারে, তাই `sudo` লাগে।

```terminal
$ chown root notes.txt   # শুধু root পারে
$ sudo chown root notes.txt
$ ls -l notes.txt
```

এখন `notes.txt`-এর মালিক root। আপনি আর এতে লিখতে পারবেন না। নিজে চেষ্টা করুন: `echo x >> notes.txt`।

server-এ এটা রোজকার সমস্যা: ফাইলের মালিক ভুল থাকলে web server সেখানে লিখতে পারে না।
