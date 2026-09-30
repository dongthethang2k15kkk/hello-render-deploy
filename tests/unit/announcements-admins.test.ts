import {afterEach, describe, expect, it, vi} from 'vitest';
import {decodeAdminSession, encodeAdminSession, googleAdminAccount} from '../../src/lib/admin-session';
import {announcementsSchema, stepSlide} from '../../src/lib/announcement-rules';

afterEach(() => vi.unstubAllEnvs());

describe('Admins added in Settings', () => {
  it('are accepted only while they are in the extra list', () => {
    vi.stubEnv('ADMIN_GOOGLE_EMAILS', 'owner@gmail.com');
    const cookie = encodeAdminSession(googleAdminAccount('helper@gmail.com'));
    expect(decodeAdminSession(cookie)).toBeNull();
    expect(decodeAdminSession(cookie, ['helper@gmail.com'])).toMatchObject({role: 'admin', email: 'helper@gmail.com'});
    expect(decodeAdminSession(cookie, ['someone@gmail.com'])).toBeNull();
    expect(decodeAdminSession(encodeAdminSession(googleAdminAccount('owner@gmail.com')))).toMatchObject({email: 'owner@gmail.com'});
  });
});

describe('announcements', () => {
  const slide = {imagePath: '/api/product-images/cmabc123def', caption: 'New packages', link: '/en#catalog'};
  it('accepts uploaded images with optional caption and safe links', () => {
    expect(announcementsSchema.safeParse({slides: [slide], intervalSeconds: 6}).success).toBe(true);
    expect(announcementsSchema.parse({slides: [{imagePath: slide.imagePath}], intervalSeconds: 5}).slides[0]).toEqual({imagePath: slide.imagePath, caption: '', link: ''});
  });
  it('rejects remote images, unsafe links, too many slides and odd intervals', () => {
    expect(announcementsSchema.safeParse({slides: [{...slide, imagePath: 'https://evil.example/x.png'}], intervalSeconds: 6}).success).toBe(false);
    expect(announcementsSchema.safeParse({slides: [{...slide, link: 'javascript:alert(1)'}], intervalSeconds: 6}).success).toBe(false);
    expect(announcementsSchema.safeParse({slides: [{...slide, link: 'http://insecure.example'}], intervalSeconds: 6}).success).toBe(false);
    expect(announcementsSchema.safeParse({slides: Array(11).fill(slide), intervalSeconds: 6}).success).toBe(false);
    expect(announcementsSchema.safeParse({slides: [slide], intervalSeconds: 1}).success).toBe(false);
  });
  it('wraps slide navigation in both directions', () => {
    expect(stepSlide(2, 1, 3)).toBe(0);
    expect(stepSlide(0, -1, 3)).toBe(2);
    expect(stepSlide(0, 1, 0)).toBe(0);
  });
});
