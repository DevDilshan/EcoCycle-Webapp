import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/api.dart';
import '../theme/eco_theme.dart';
import '../widgets/eco_components.dart';

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  final _api = Api();
  List<Map<String, dynamic>> _entries = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final json = await _api.get('/rewards/leaderboard', query: {'limit': '50'});
      setState(() {
        _entries = (json as List?)?.cast<Map<String, dynamic>>() ?? [];
      });
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final userId = Supabase.instance.client.auth.currentUser?.id;
    return EcoScreen(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const EcoBackHeader(title: 'Leaderboard', subtitle: 'Top recyclers'),
          if (_loading)
            const Expanded(child: Center(child: CircularProgressIndicator(color: EcoColors.primary)))
          else
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(22, 0, 22, 24),
                itemCount: _entries.length,
                itemBuilder: (context, i) {
                  final e = _entries[i];
                  final rank = (e['rank'] as num?)?.toInt() ?? i + 1;
                  final isMe = e['residentId'] == userId;
                  final name = e['residentName'] as String? ?? 'Resident';
                  final pts = (e['totalPoints'] as num?)?.toInt() ?? 0;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: isMe ? EcoColors.mintBg : Colors.white,
                      border: Border.all(color: isMe ? EcoColors.primary : EcoColors.cardBorder, width: isMe ? 1.5 : 1),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 24,
                          child: Text(
                            '$rank',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: isMe ? EcoColors.primary : EcoColors.muted,
                            ),
                          ),
                        ),
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: isMe ? EcoColors.primary : EcoColors.avatarBg,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            name.isNotEmpty ? name[0].toUpperCase() : '?',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: isMe ? Colors.white : const Color(0xFF4A6A55),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            isMe ? 'You · $name' : name,
                            style: TextStyle(
                              fontWeight: isMe ? FontWeight.w700 : FontWeight.w600,
                              fontSize: 13,
                              color: isMe ? EcoColors.primary : EcoColors.ink,
                            ),
                          ),
                        ),
                        Text('$pts', style: const TextStyle(fontWeight: FontWeight.w800, color: EcoColors.primary, fontSize: 13)),
                      ],
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
