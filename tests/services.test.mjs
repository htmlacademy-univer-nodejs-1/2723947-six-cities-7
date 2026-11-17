import 'reflect-metadata';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import test from 'node:test';
import {container} from '../dist/shared/di/container.js';
import {Component} from '../dist/shared/di/component.js';
import {readOffers} from '../dist/tsv-file-reader.js';

test('services cover rental scenarios, independent favorites, ratings and sessions', {
  skip: !process.env.MONGODB_TEST_URI,
  timeout: 60000,
}, async (t) => {
  const url = new URL(process.env.MONGODB_TEST_URI);
  url.pathname = `/six_cities_test_${randomUUID().replaceAll('-', '')}`;
  const database = container.get(Component.Database);
  const connection = container.get(Component.MongoConnection);
  const users = container.get(Component.UserService);
  const offers = container.get(Component.OfferService);
  const comments = container.get(Component.CommentService);
  const favorites = container.get(Component.FavoriteService);
  const auth = container.get(Component.AuthService);
  const notFound = {code: 'NOT_FOUND'};
  try {
    await database.connect(url.toString());
    const author = await users.create({name: 'Author', email: 'author@example.com', password: 'author123', type: 'pro'});
    const guest = await users.create({name: 'Guest', email: 'guest@example.com', password: 'guest123', type: 'regular'});
    const reader = readOffers('mocks/offers.tsv');
    const {value: {authorEmail, rating, isFavorite, ...data}} = await reader.next();
    await reader.return();
    const offer = await offers.create({...data, authorId: author.id, rating: 5, commentsCount: 99, isFavorite: true});
    const id = offer._id.toString();

    await t.test('computed fields cannot be written and only the owner can change an offer', async () => {
      assert.equal(offer.commentsCount, 0);
      assert.equal(offer.rating, 1);
      assert.equal(offer.isFavorite, false);
      assert.equal(offer.ratingSum, undefined);
      assert.equal(offer.author.passwordHash, undefined);
      assert.equal(author.passwordHash, undefined);
      const updated = await offers.updateById(id, {price: 999, rating: 5, commentsCount: 99, authorId: guest.id}, author.id);
      assert.equal(updated.price, 999);
      assert.equal(updated.rating, 1);
      assert.equal(updated.commentsCount, 0);
      assert.equal(updated.author._id.toString(), author.id);
      await assert.rejects(offers.updateById(id, {price: 100}, guest.id), {code: 'FORBIDDEN'});
      await assert.rejects(offers.deleteById(id, guest.id), {code: 'FORBIDDEN'});
      assert.equal(await offers.updateById('000000000000000000000000', {price: 100}, author.id), null);
      await assert.rejects(offers.create({...data, authorId: '000000000000000000000000'}), notFound);
      assert.equal((await users.updateById(author.id, {name: 'Host', passwordHash: 'overwritten'})).name, 'Host');
      assert.ok(await users.verifyPassword(author.email, 'author123'));
    });

    await t.test('favorites belong to users and concurrent repeated additions are idempotent', async () => {
      await Promise.all(Array.from({length: 8}, () => favorites.add({userId: guest.id, offerId: id})));
      assert.equal(await connection.collection('favorites').countDocuments(), 1);
      assert.equal((await offers.findById(id, guest.id)).isFavorite, true);
      assert.equal((await offers.findById(id, author.id)).isFavorite, false);
      assert.equal((await offers.findById(id)).isFavorite, false);
      assert.equal((await favorites.findByUserId(guest.id)).length, 1);
      assert.deepEqual(await favorites.findByUserId(author.id), []);
      assert.equal((await favorites.remove(guest.id, id)).isFavorite, false);
      assert.equal((await favorites.remove(guest.id, id)).isFavorite, false);
      await assert.rejects(favorites.add({userId: guest.id, offerId: '000000000000000000000000'}), notFound);
      await favorites.add({userId: guest.id, offerId: id});
    });

    await t.test('ratings update after every comment, round half up and include more than the latest 50', async () => {
      const ratings = [4, 4, 4, 5];
      const earliestDate = new Date();
      for (const value of ratings) {
        const comment = await comments.create({text: 'A useful review', rating: value, offerId: id, authorId: guest.id, publicationDate: new Date(0)});
        assert.ok(comment.publicationDate >= earliestDate);
        assert.equal(comment.author.passwordHash, undefined);
        assert.equal(comment.author._id.toString(), guest.id);
      }
      assert.equal((await offers.findById(id)).rating, 4.3);
      const concurrentRatings = Array.from({length: 52}, (_, i) => i % 5 + 1);
      await Promise.all(concurrentRatings.map((value) => comments.create({text: `Rating ${value}`, rating: value, offerId: id, authorId: guest.id})));
      const allRatings = [...ratings, ...concurrentRatings];
      const current = await offers.findById(id);
      assert.equal(current.commentsCount, allRatings.length);
      assert.equal(current.rating, Math.round(allRatings.reduce((sum, value) => sum + value, 0) / allRatings.length * 10) / 10);
      const latest = await comments.findByOfferId(id);
      assert.equal(latest.length, 50);
      for (let i = 1; i < latest.length; i++) {
        assert.ok(latest[i - 1].publicationDate >= latest[i].publicationDate);
      }
      const raw = await connection.collection('offers').findOne({_id: offer._id});
      assert.equal(raw.ratingSum, allRatings.reduce((sum, value) => sum + value, 0));
      await assert.rejects(comments.create({text: 'Missing offer', rating: 5, offerId: '000000000000000000000000', authorId: guest.id}), notFound);
      assert.equal(await connection.collection('comments').countDocuments(), allRatings.length);
    });

    await t.test('offer lists use the required fields, ordering and limits', async () => {
      for (let i = 0; i < 65; i++) {
        await offers.create({...data, authorId: author.id, city: i % 2 ? 'Paris' : 'Amsterdam', isPremium: i % 3 !== 0, publicationDate: new Date(Date.UTC(2026, 10, 1, 0, i))});
      }
      const list = await offers.find();
      assert.equal(list.length, 60);
      assert.equal((await offers.find(100)).length, 66);
      assert.equal(list[0].description, undefined);
      assert.equal(list[0].author, undefined);
      assert.equal(list[0].ratingSum, undefined);
      assert.deepEqual(Object.keys(list[0]).sort(), ['_id', 'title', 'price', 'housingType', 'publicationDate', 'city', 'previewImage', 'isPremium', 'rating', 'commentsCount', 'isFavorite'].sort());
      for (let i = 1; i < list.length; i++) {
        assert.ok(list[i - 1].publicationDate >= list[i].publicationDate);
      }
      const premium = await offers.findPremium('Paris');
      assert.equal(premium.length, 3);
      assert.ok(premium.every((item) => item.city === 'Paris' && item.isPremium));
      assert.deepEqual(await offers.findPremium('Hamburg'), []);
      await assert.rejects(offers.find(0));
    });

    await t.test('sessions authenticate, expire and can be revoked without exposing secrets', async () => {
      await assert.rejects(auth.login({email: author.email, password: 'wrong'}), {code: 'UNAUTHORIZED'});
      await assert.rejects(auth.login({email: 'missing@example.com', password: 'wrong'}), {code: 'UNAUTHORIZED'});
      const session = await auth.login({email: author.email, password: 'author123'});
      assert.equal(session.user.passwordHash, undefined);
      assert.equal((await auth.check(session.token)).id, author.id);
      const stored = await connection.collection('sessions').findOne({user: author._id});
      assert.equal(stored.token, undefined);
      assert.equal(stored.tokenHash, createHash('sha256').update(session.token).digest('hex'));
      await auth.logout(session.token);
      await assert.rejects(auth.check(session.token), {code: 'UNAUTHORIZED'});
      await assert.rejects(auth.logout(session.token), {code: 'UNAUTHORIZED'});
      const expired = await auth.login({email: author.email, password: 'author123'});
      await connection.collection('sessions').updateMany({user: author._id}, {$set: {expiresAt: new Date(0)}});
      await assert.rejects(auth.check(expired.token), {code: 'UNAUTHORIZED'});
    });

    await t.test('deleting an offer cascades to all comments and favorites', async () => {
      assert.equal(await offers.deleteById(id, author.id), true);
      assert.equal(await offers.findById(id), null);
      assert.equal(await connection.collection('comments').countDocuments({offer: offer._id}), 0);
      assert.equal(await connection.collection('favorites').countDocuments({offer: offer._id}), 0);
      assert.deepEqual(await favorites.findByUserId(guest.id), []);
      await assert.rejects(comments.findByOfferId(id), notFound);
      assert.equal(await offers.deleteById(id, author.id), false);
    });
  } finally {
    try {
      if (connection.readyState === 1) {
        await connection.dropDatabase();
      }
    } finally {
      await database.disconnect();
    }
  }
});
