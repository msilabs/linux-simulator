---
title: কপি, সরানো আর মোছা: cp, mv, rm
order: 6
summary: ফাইল কপি করা, সরানো, নাম বদলানো আর মুছে ফেলা।
---

## cp: কপি

`cp উৎস গন্তব্য`। গন্তব্য ফোল্ডার হলে একই নামে ভেতরে কপি হয়, নতুন নাম হলে সেই নামে।

- `cp notes.txt notes-backup.txt`: একই জায়গায় নতুন নামে কপি।
- `cp notes.txt projects/`: ফোল্ডারের ভেতরে কপি।
- `cp -r projects backup`: পুরো ফোল্ডার কপি করতে `-r` (recursive) লাগে।

```terminal
$ cp notes.txt notes-backup.txt
$ cp -r projects projects-copy
$ ls
```

## mv: সরানো আর নাম বদলানো

`mv` একই command দিয়ে দুই কাজ করে:

- `mv a.txt b.txt`: নাম বদলায়।
- `mv a.txt docs/`: অন্য ফোল্ডারে সরায়।

ফোল্ডার সরাতে `-r` লাগে না।

```terminal
$ mv downloads/old-notes.txt downloads/archive.txt
$ mkdir -p downloads/music
$ mv downloads/song.mp3 downloads/music/
$ ls downloads downloads/music
```

## rm: মোছা

`rm ফাইল` মুছে ফেলে। Windows-এর Recycle Bin-এর মতো কিছু নেই, মুছলে আর ফেরত আসে না। (এখানে নকল, তাই Undo আছে।)

- `rm -r ফোল্ডার`: ফোল্ডার আর ভেতরের সব মোছে।
- `rmdir ফোল্ডার`: শুধু খালি ফোল্ডার মোছে। ভুল করে ভরা ফোল্ডার মোছা থেকে বাঁচায়।

```terminal
$ rm downloads/setup.zip
$ rmdir projects   # ভেতরে ফাইল আছে, তাই মুছবে না
$ ls downloads
```

## rm -rf: সবচেয়ে বিপজ্জনক command

`rm -rf` কিছু জিজ্ঞেস না করে সব মোছে। `rm -rf /` দিলে আসল কম্পিউটারের সবকিছু মুছে যেতে পারে। এই simulator এটা আটকে দিয়ে বুঝিয়ে বলে। নিজে চালিয়ে দেখুন, কিছু হবে না।
