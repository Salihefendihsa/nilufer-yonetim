// Bölüm AH (8. tur): izin bakiyesi model/bayrak ayrıştırma testleri.

import 'package:flutter_test/flutter_test.dart';

import 'package:nilufer_mobile/features/staff/leave_balance_card.dart';
import 'package:nilufer_mobile/models/leave_request.dart';
import 'package:nilufer_mobile/models/staff.dart';

void main() {
  group('LeaveBalance.fromJson', () {
    test('kalan/kota ve yüzde hesaplanır', () {
      final b = LeaveBalance.fromJson({
        'staffId': 's1',
        'year': 2027,
        'quotaDays': 14,
        'usedDays': 7,
        'remainingDays': 7,
        'approvedRequestCount': 2,
      });
      expect(b.year, 2027);
      expect(b.usedPercent, 50);
      expect(b.isOver, isFalse);
    });

    test('bakiye aşımı: remaining negatif → isOver, yüzde 100 ile sınırlı', () {
      final b = LeaveBalance.fromJson({
        'year': 2027,
        'quotaDays': 10,
        'usedDays': 12,
        'remainingDays': -2,
        'approvedRequestCount': 3,
      });
      expect(b.isOver, isTrue);
      expect(b.usedPercent, 100);
    });

    test('kota 0 → yüzde 0 (bölme hatası yok)', () {
      final b = LeaveBalance.fromJson({
        'year': 2027,
        'quotaDays': 0,
        'usedDays': 0,
        'remainingDays': 0,
        'approvedRequestCount': 0,
      });
      expect(b.usedPercent, 0);
    });
  });

  group('LeaveRequest bakiye bayrakları', () {
    test('exceedsBalance ve gün alanları okunur; eksikse varsayılan', () {
      final base = {
        'id': 'l1',
        'staffId': 's1',
        'startDate': '2027-07-01T00:00:00.000Z',
        'endDate': '2027-07-05T00:00:00.000Z',
        'reason': 'tatil',
        'status': 'PENDING',
        'requestedAt': '2027-06-01T00:00:00.000Z',
      };
      final flagged = LeaveRequest.fromJson({
        ...base,
        'requestedDays': 5,
        'remainingDays': 3,
        'exceedsBalance': true,
      });
      expect(flagged.requestedDays, 5);
      expect(flagged.remainingDays, 3);
      expect(flagged.exceedsBalance, isTrue);

      final plain = LeaveRequest.fromJson(base);
      expect(plain.requestedDays, isNull);
      expect(plain.exceedsBalance, isFalse);
    });
  });

  test('Staff.annualLeaveQuotaDays: yoksa 14', () {
    final json = {
      'id': 's1',
      'userId': 'u1',
      'position': 'Teknisyen',
      'salaryBase': '10000',
      'createdAt': '2026-01-01T00:00:00.000Z',
      'user': {
        'id': 'u1',
        'fullName': 'A',
        'email': 'a@b.c',
        'role': 'STAFF',
        'isActive': true,
      },
    };
    expect(Staff.fromJson(json).annualLeaveQuotaDays, 14);
    expect(
      Staff.fromJson({...json, 'annualLeaveQuotaDays': 20})
          .annualLeaveQuotaDays,
      20,
    );
  });
}
