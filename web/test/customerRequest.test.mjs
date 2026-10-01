import assert from "node:assert/strict";
import { test } from "node:test";

import { CustomerRequestGuard, selectedCustomerDetail, uploadCustomerDocuments } from "../src/lib/customerRequest.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function handlers(state) {
  return {
    onSuccess: (value) => { state.value = value; },
    onError: (error) => { state.error = error.message; },
    onSettled: () => { state.settled++; },
  };
}

test("A seçiliyken B geçiş renderında A detayı görünmez", () => {
  const detailA = { id: "A", fullName: "A müşterisi" };
  assert.equal(selectedCustomerDetail(detailA, "A"), detailA);
  assert.equal(selectedCustomerDetail(detailA, "B"), null);
  assert.equal(selectedCustomerDetail(detailA, null), null);
});

test("B yanıtından sonra gelen A yanıtı B durumunu değiştirmez", async () => {
  const a = deferred();
  const b = deferred();
  const state = { value: null, error: null, settled: 0 };
  const scopeA = new CustomerRequestGuard();
  const taskA = scopeA.runLatest(() => a.promise, handlers(state));
  scopeA.close();
  const scopeB = new CustomerRequestGuard();
  const taskB = scopeB.runLatest(() => b.promise, handlers(state));
  b.resolve({ id: "B" });
  await taskB;
  a.resolve({ id: "A" });
  await taskA;
  assert.deepEqual(state, { value: { id: "B" }, error: null, settled: 1 });
});

test("eski isteğin hatası ve finally sonucu yeni müşteriye taşınmaz", async () => {
  const a = deferred();
  const b = deferred();
  const state = { value: null, error: null, settled: 0 };
  const scopeA = new CustomerRequestGuard();
  const taskA = scopeA.runLatest(() => a.promise, handlers(state));
  scopeA.close();
  const scopeB = new CustomerRequestGuard();
  const taskB = scopeB.runLatest(() => b.promise, handlers(state));
  a.reject(new Error("A isteği hata verdi"));
  await taskA;
  assert.deepEqual(state, { value: null, error: null, settled: 0 });
  b.resolve({ id: "B" });
  await taskB;
  assert.deepEqual(state, { value: { id: "B" }, error: null, settled: 1 });
});

test("panel kapanıp aynı müşteriyle açıldığında eski yanıt geçersiz kalır", async () => {
  const old = deferred();
  const fresh = deferred();
  const state = { value: null, error: null, settled: 0 };
  const oldScope = new CustomerRequestGuard();
  const oldTask = oldScope.runLatest(() => old.promise, handlers(state));
  oldScope.close();
  const newScope = new CustomerRequestGuard();
  const newTask = newScope.runLatest(() => fresh.promise, handlers(state));
  fresh.resolve({ id: "A", version: "yeni" });
  await newTask;
  old.resolve({ id: "A", version: "eski" });
  await oldTask;
  assert.deepEqual(state.value, { id: "A", version: "yeni" });
  assert.equal(state.settled, 1);
});

test("B belge yüklemesi B ID'sine gider ve B listesi yenilenir", async () => {
  const scopeB = new CustomerRequestGuard();
  const calls = [];
  const docs = { value: [], error: null, settled: 0 };
  const uploaded = await uploadCustomerDocuments("B", ["belge.pdf"], () => scopeB.isActive(), async (id, file) => {
    calls.push([id, file]);
  });
  if (uploaded) await scopeB.runLatest(async () => ({ id: "B", files: ["belge.pdf"] }), handlers(docs));
  assert.deepEqual(calls, [["B", "belge.pdf"]]);
  assert.deepEqual(docs.value, { id: "B", files: ["belge.pdf"] });
});

test("A yüklemesi sürerken panel değişirse ikinci A dosyası başlamaz ve B listesi etkilenmez", async () => {
  const firstUpload = deferred();
  const scopeA = new CustomerRequestGuard();
  const scopeB = new CustomerRequestGuard();
  const calls = [];
  const docsB = { value: ["B belgesi"], error: null, settled: 0 };
  const uploadA = uploadCustomerDocuments("A", ["ilk.pdf", "ikinci.pdf"], () => scopeA.isActive(), async (id, file) => {
    calls.push([id, file]);
    await firstUpload.promise;
  });
  scopeA.close();
  await scopeB.runLatest(async () => ["B belgesi"], handlers(docsB));
  firstUpload.resolve();
  assert.equal(await uploadA, false);
  assert.deepEqual(calls, [["A", "ilk.pdf"]]);
  assert.deepEqual(docsB.value, ["B belgesi"]);
});

test("Strict Mode temizleme ve yeniden kurulumda ilk istek yok sayılır", async () => {
  const old = deferred();
  const fresh = deferred();
  const scope = new CustomerRequestGuard();
  const state = { value: null, error: null, settled: 0 };
  const oldTask = scope.runLatest(() => old.promise, handlers(state));
  scope.close();
  scope.open();
  const newTask = scope.runLatest(() => fresh.promise, handlers(state));
  old.resolve("eski");
  fresh.resolve("yeni");
  await Promise.all([oldTask, newTask]);
  assert.deepEqual(state, { value: "yeni", error: null, settled: 1 });
});
