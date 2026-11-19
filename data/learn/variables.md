---
title: shell সাজানো: $VAR, export, PATH, alias
order: 16
summary: variable রাখা, PATH বোঝা, আর বড় command-এর ছোট নাম বানানো।
---

## variable

`NAME=মান` দিয়ে variable বানানো হয়। `=`-এর দুই পাশে space দেওয়া যাবে না। মান ব্যবহার করতে নামের আগে `$`:

```terminal
$ NAME=rahim
$ echo "হ্যালো $NAME"
```

## পরিবেশের variable

shell চালু হলেই কিছু variable থাকে। `env` সব দেখায়:

| variable | মানে |
| --- | --- |
| `$HOME` | home ফোল্ডার |
| `$USER` | user-এর নাম |
| `$PWD` | এখনকার ফোল্ডার |
| `$PATH` | command কোন কোন ফোল্ডারে খোঁজা হবে |

```terminal
$ echo $HOME $USER
$ env
```

`export NAME=মান` দিলে variable এই shell থেকে চালানো অন্য program-ও পায়। `.env` ফাইল আর server-এর setting এভাবেই কাজ করে।

## PATH

`ls` লিখলে shell `$PATH`-এর ফোল্ডারগুলো বাঁ থেকে ডানে খোঁজে, যেখানে প্রথম পায় সেটা চালায়। কোনো command "not found" হলে সাধারণত তার ফোল্ডার PATH-এ নেই।

```terminal
$ echo $PATH
$ which ls
```

## alias: ছোট নাম

`alias ll='ls -la'` বানালে `ll` লিখলেই `ls -la` চলে। `alias` একা দিলে সব alias দেখায়, `unalias ll` মুছে দেয়।

```terminal
$ alias ll='ls -la'
$ ll
```

আসল Linux-এ এগুলো shell বন্ধ হলে হারিয়ে যায়। স্থায়ী করতে `~/.bashrc` ফাইলে লেখা হয়। `cat ~/.bashrc` দিয়ে দেখুন।

সব পাঠ শেষ। এবার Challenge-এ গিয়ে নিজে নিজে সমস্যা সমাধান করে দেখুন।
