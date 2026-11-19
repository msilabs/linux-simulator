---
title: সাহায্য নেওয়া: man আর help
order: 12
summary: কোনো command-এর option ভুলে গেলে terminal-এর ভেতরেই উত্তর খোঁজা।
---

কেউ সব option মুখস্থ রাখে না। দরকার হলে দেখে নেয়।

## help

`help` এই simulator-এর সব command-এর তালিকা দেখায়, প্রতিটার এক লাইনের বাংলা বিবরণসহ।

```terminal
$ help
```

## man

`man command` একটা command-এর manual দেখায়: কী করে, কীভাবে লিখতে হয়, কাজের option আর উদাহরণ। আসল Linux-এ manual English-এ, এখানে বাংলায় ছোট করে লেখা।

```terminal
$ man grep
```

## which

`which ls` বলে command-টা আসলে কোন ফাইল। command-ও এক ধরনের program ফাইল, যা `/usr/bin`-এর মতো ফোল্ডারে থাকে।

```terminal
$ which ls
```

## history

`history` আগে চালানো command-এর তালিকা দেখায়। ↑ key দিয়েও আগের command আনা যায়।

নিজে চেষ্টা করুন: `man tail` পড়ে বের করুন, শেষ ২০ লাইন দেখার option কী।
