# কাজের নিয়ম

## Commit
- Commit শুধু এই নামে ও ইমেইলে হবে: `msisaif <61042251+msisaif@users.noreply.github.com>`।
- Author ও committer দুটোই এই পরিচয়ে থাকবে।
- Commit মেসেজে কোনো attribution লাইন রাখা যাবে না।

## Push
- মালিক না বললে `git push` করা যাবে না।

## Stack
- সাইট [Alo](https://github.com/msilabs/alo) (`@msilabs/alo`) দিয়ে বানানো। কোনো `.alo` ফাইল বদলানোর আগে `AGENTS.md` পড়তে হবে।
- CSS `global/style.css`-এ। JS-এ বানানো HTML-এ scoped `<style>` পৌঁছায় না।
- engine (`global/` ফোল্ডারে `90-app.js` ছাড়া সব JS) সাধারণ script, DOM ছাড়া চলে, Node-এও `require` করা যায়। DOM-এর কাজ শুধু `90-app.js`-এ।
- `node alo build` আর `npm test` দুটোই ভুল ছাড়া শেষ হতে হবে। `dist/` আর `.alo/` হাতে বদলানো যাবে না।
- `@msilabs/alo` ছাড়া কোনো npm package যোগ করা যাবে না।
- পরিকল্পনা আছে `/Users/msi/msilabs/plans/linux-simulator-plan.md`-এ।
