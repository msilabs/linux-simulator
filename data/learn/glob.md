---
title: একসাথে অনেক ফাইল: * আর ?
order: 7
summary: নামের আকার দিয়ে একসাথে অনেক ফাইল ধরা।
---

`downloads`-এ দুটো ছবি আছে। দুটো আলাদা করে না লিখে একবারে ধরা যায়:

- `*`: যেকোনো কিছু, যত অক্ষরই হোক (কিছু না হলেও চলে)।
- `?`: ঠিক একটা যেকোনো অক্ষর।

তাই `*.jpg` মানে "নামের শেষে `.jpg` আছে এমন সব"। `photo?.jpg` মানে `photo1.jpg`, `photo2.jpg`, কিন্তু `photo10.jpg` না।

```terminal
$ cd downloads
$ ls *.pdf
$ ls photo?.jpg
```

## shell আগে বাড়িয়ে দেয়

`*` আসলে `ls` বোঝে না। command চালানোর আগে shell নিজেই `*.pdf`-কে মেলা নামগুলো দিয়ে বদলে দেয়, তারপর `ls report.pdf resume.pdf` চলে। `echo` দিয়ে এটা চোখে দেখা যায়:

```terminal
$ echo downloads/*
```

## কাজে লাগানো

```terminal
$ cd downloads
$ mkdir pics docs
$ mv *.jpg pics/
$ mv *.pdf docs/
$ ls
```

কিছুই না মিললে shell `*` বদলায় না, ফলে `ls *.xyz` চালালে `No such file or directory` আসে।

`rm *` চালানোর আগে সবসময় একবার `ls *` দিয়ে দেখে নিন কী কী মুছবে।
