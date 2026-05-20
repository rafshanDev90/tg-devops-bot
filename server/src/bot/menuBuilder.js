class MenuBuilder {
  static mainMenu() {
    return {
      text:
        `📚 <b>AMUST Hub</b>\n\n` +
        `Welcome! Choose an option below:\n\n` +
        `📖 <b>Study</b> — AI assistant & assignments\n` +
        `📅 <b>Routine</b> — Class schedules\n` +
        `📝 <b>Notes</b> — Personal knowledge vault\n` +
        `🗺️ <b>Learning</b> — PyTorch roadmap tracker\n` +
        `💻 <b>Python Lab</b> — Run code in sandbox\n` +
        `👤 <b>Profile</b> — Your account\n` +
        `ℹ️ <b>Status</b> — System health`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📖 Study Assistant', callback_data: 'menu_study' }],
          [{ text: '📅 Class Routine', callback_data: 'menu_routine' }],
          [{ text: '📝 Knowledge Vault', callback_data: 'menu_notes' }],
          [
            { text: '🗺️ Learning Roadmap', callback_data: 'menu_learn' },
            { text: '💻 Python Lab', callback_data: 'menu_run' },
          ],
          [{ text: '👤 My Profile', callback_data: 'menu_profile' }],
          [{ text: 'ℹ️ System Status', callback_data: 'menu_status' }],
        ],
      },
    };
  }

  static learningMenu() {
    return {
      text: `🗺️ <b>Learning Roadmap</b>\n\nTrack your learning progress, schedule topics, and link notes:`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Dashboard', callback_data: 'learn_view' }],
          [{ text: '➕ Add Topic', callback_data: 'learn_add_prompt' }],
          [{ text: '🔍 Search', callback_data: 'learn_search_prompt' }],
          [{ text: '📅 Today\'s Plan', callback_data: 'learn_today' }],
          [{ text: '🔙 Back', callback_data: 'menu_back' }],
        ],
      },
    };
  }

  static runMenu() {
    return {
      text:
        `💻 <b>Python Lab</b>\n\n` +
        `Run Python & PyTorch code in a secure sandbox.\n\n` +
        `Send code using:\n` +
        `<pre>/run\n\`\`\`python\nimport torch\nprint(torch.__version__)\n\`\`\`</pre>`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '▶️ Run Code', callback_data: 'run_prompt' }],
          [{ text: '🔙 Back', callback_data: 'menu_back' }],
        ],
      },
    };
  }

  static studyMenu() {
    return {
      text:
        `📖 <b>Study Assistant</b>\n\n` +
        `Choose a study option:`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '❓ Ask AI', callback_data: 'study_ask' }],
          [{ text: '🌐 Web Search', callback_data: 'study_search' }],
          [{ text: '📋 Assignments', callback_data: 'study_assign' }],
          [{ text: '🔙 Back', callback_data: 'menu_back' }],
        ],
      },
    };
  }

  static routineMenu() {
    return {
      text:
        `📅 <b>Class Routine</b>\n\n` +
        `Choose a routine option:`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📆 Today\'s Classes', callback_data: 'routine_today' }],
          [{ text: '📋 Weekly Routine', callback_data: 'routine_week' }],
          [{ text: '📤 Upload Routine', callback_data: 'routine_upload' }],
          [{ text: '🗑️ Clear Routine', callback_data: 'routine_clear' }],
          [{ text: '🔙 Back', callback_data: 'menu_back' }],
        ],
      },
    };
  }

  static notesMenu() {
    return {
      text:
        `📝 <b>Knowledge Vault</b>\n\n` +
        `Choose a notes option:`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '➕ Add Note', callback_data: 'notes_add' }],
          [{ text: '📋 List Notes', callback_data: 'notes_list' }],
          [{ text: '🔍 Search Notes', callback_data: 'notes_search' }],
          [{ text: '🏷️ View Tags', callback_data: 'notes_tags' }],
          [{ text: '🔙 Back', callback_data: 'menu_back' }],
        ],
      },
    };
  }

  static profileMenu(student) {
    const dept = student.academic.department;
    const batch = student.academic.batch;
    const uni = student.academic.university;

    return {
      text:
        `👤 <b>Your Profile</b>\n\n` +
        `🏛️ ${escapeHtml(uni)}\n` +
        `🎓 ${escapeHtml(dept)} | Batch ${batch}\n` +
        `🆔 ${escapeHtml(student.academic.universityId || 'Not set')}\n\n` +
        `Choose an option:`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Edit Profile', callback_data: 'profile_edit' }],
          [{ text: '📊 Activity Stats', callback_data: 'profile_stats' }],
          [{ text: '🔙 Back', callback_data: 'menu_back' }],
        ],
      },
    };
  }

  static adminMenu() {
    return {
      text:
        `🛡️ <b>Admin Panel</b>\n\n` +
        `Choose an admin option:`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 Dashboard', callback_data: 'admin_dashboard' }],
          [{ text: '👥 Users', callback_data: 'admin_users' }],
          [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }],
          [{ text: '📈 Analytics', callback_data: 'admin_stats' }],
          [{ text: '🔙 Back', callback_data: 'menu_back' }],
        ],
      },
    };
  }

  static noteActions(noteId, isEncrypted) {
    const rows = [];
    if (isEncrypted) {
      rows.push([{ text: '🔓 Reveal Content', callback_data: `reveal_${noteId}` }]);
    }
    rows.push([{ text: '📋 Copy', callback_data: `copy_${noteId}` }]);
    rows.push([
      { text: '✏️ Edit', callback_data: `edit_${noteId}` },
      { text: '🗑️ Delete', callback_data: `confirm_delete_${noteId}` },
    ]);
    rows.push([{ text: '🔙 Back to List', callback_data: 'notes_list' }]);

    return {
      reply_markup: { inline_keyboard: rows },
    };
  }

  static confirmDelete(actionId) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗑️ Yes, Delete', callback_data: `delete_${actionId}` }],
          [{ text: '❌ Cancel', callback_data: `cancel_delete_${actionId}` }],
        ],
      },
    };
  }

  static categorySelector() {
    const categories = [
      ['credentials', '🔑 Credentials'],
      ['requirements', '📋 Requirements'],
      ['meetings', '🤝 Meetings'],
      ['snippets', '💻 Snippets'],
      ['servers', '🖥️ Servers'],
      ['other', '📌 Other'],
    ];

    const keyboard = [];
    for (let i = 0; i < categories.length; i += 2) {
      const row = [{ text: categories[i][1], callback_data: `cat_${categories[i][0]}` }];
      if (categories[i + 1]) {
        row.push({ text: categories[i + 1][1], callback_data: `cat_${categories[i + 1][0]}` });
      }
      keyboard.push(row);
    }
    keyboard.push([{ text: '🔙 Cancel', callback_data: 'notes_cancel' }]);

    return { reply_markup: { inline_keyboard: keyboard } };
  }

  static encryptSelector() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔒 Yes, Encrypt', callback_data: 'encrypt_yes' }],
          [{ text: '📄 No, Plain Text', callback_data: 'encrypt_no' }],
          [{ text: '🔙 Cancel', callback_data: 'notes_cancel' }],
        ],
      },
    };
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export { MenuBuilder };
