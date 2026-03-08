// i18n.js - Internationalization module for Russian language

const translations = {
    // Common
    save: 'Сохранить',
    cancel: 'Отмена',
    close: 'Закрыть',
    copy: 'Копировать',
    load: 'Загрузить',
    run: 'Выполнить',
    execute: 'Выполнить',
    executing: 'Выполнение...',
    loading: 'Загрузка...',
    send: 'Отправить',
    clear: 'Очистить',
    refresh: 'Обновить',

    // Header
    configEditor: 'Редактор конфигураций',
    launch: 'Запуск',
    stop: 'Стоп',
    restartXkeen: 'Перезапуск Xkeen',
    logout: 'Выход',

    // Tabs
    editor: 'Редактор',
    logs: 'Логи',
    settings: 'Настройки',
    commands: 'Команды',

    // Editor
    configFiles: 'Файлы конфигурации',
    fileNotSelected: 'Файл не выбран',
    validJson: 'Верный JSON',
    invalidJson: 'Неверный JSON',
    changes: 'Изменения',
    backups: 'Резервные копии',

    // Logs
    accessLog: 'Журнал доступа',
    errorLog: 'Журнал ошибок',
    searchLogs: 'Поиск в логах...',
    allLevels: 'Все уровни',
    errors: 'Ошибки',
    warnings: 'Предупреждения',
    information: 'Информация',

    // Settings
    xraySettings: 'Настройки Xray',
    mihomoSettings: 'Настройки Mihomo',
    applyAndRestart: 'Применить и перезапустить',
    refreshSettings: 'Обновить настройки',

    // Mode
    mode: 'Режим',
    activeMode: 'Активный режим:',
    currentMode: 'Текущий режим:',
    modeDescription: 'Описание режимов:',
    xrayDescription: 'Использует ядро Xray с JSON файлами конфигурации',
    mihomoDescription: 'Использует ядро Mihomo (Clash.Meta) с YAML файлами конфигурации',
    mihomoDirNotFound: 'Директория конфигураций Mihomo не найдена',
    xrayNotInstalled: 'Xray не установлен',
    mihomoNotInstalled: 'Mihomo не установлен',
    switchedTo: 'Переключено на',

    // Logging
    logging: 'Логирование',
    logLevel: 'Уровень логов:',
    levelDescriptions: 'Описание уровней:',
    debugDesc: 'Подробная отладочная информация',
    infoDesc: 'Общая информация о работе',
    warningDesc: 'Только предупреждения',
    errorDesc: 'Только ошибки',
    noneDesc: 'Отключить логирование',
    currentLogFiles: 'Текущие файлы логов:',
    accessLogFile: 'Лог доступа:',
    errorLogFile: 'Лог ошибок:',
    loggingDisabledWarning: 'Внимание: Логирование отключено. Логи не будут записываться в файлы.',

    // Updates
    updates: 'Обновления',
    currentVersion: 'Текущая версия:',
    latestVersion: 'Последняя версия:',
    releaseNotes: 'примечания',
    newVersionAvailable: 'Доступна новая версия!',
    newDevVersionAvailable: 'Доступна новая dev версия!',
    latestVersionInstalled: 'Установлена последняя версия.',
    latestDevVersionInstalled: 'Установлена последняя dev версия.',
    checkDevUpdates: 'Проверять dev обновления',
    devBuildsHint: 'Development-сборки содержат последние функции, но могут быть нестабильны',
    checkForUpdates: 'Проверить обновления',
    checking: 'Проверка...',
    updateNow: 'Обновить',
    updating: 'Обновление...',
    updateComplete: 'Обновление завершено!',
    updateFailed: 'Ошибка обновления:',

    // Security
    security: 'Безопасность',
    currentPassword: 'Текущий пароль:',
    newPassword: 'Новый пароль:',
    confirmPassword: 'Подтверждение пароля:',
    enterCurrentPassword: 'Введите текущий пароль',
    min8Chars: 'Минимум 8 символов',
    reenterNewPassword: 'Повторите новый пароль',
    passwordRequirements: 'Требования к паролю:',
    min8CharsReq: 'Минимум 8 символов',
    mustDifferFromCurrent: 'Должен отличаться от текущего пароля',
    passwordChanged: 'Пароль успешно изменён!',
    changePassword: 'Изменить пароль',
    changing: 'Изменение...',

    // Modals
    commandOutput: 'Вывод команды:',
    enterInputAndPressEnter: 'Введите данные и нажмите Enter...',
    copyOutput: 'Скопировать вывод',
    confirmCommand: 'Подтверждение команды',
    confirmCommandQuestion: 'Вы уверены, что хотите выполнить эту команду?',
    backupsTitle: 'Резервные копии:',
    noBackupsAvailable: 'Нет доступных резервных копий',
    diffWithCurrentFile: 'Сравнение с текущим файлом',
    changesSinceLastSave: 'Изменения с последнего сохранения',

    // Toast messages
    savedSuccessfully: 'Сохранено успешно',
    saveFailed: 'Ошибка сохранения',
    noFileSelected: 'Файл не выбран',
    failedToLoadFiles: 'Не удалось загрузить файлы',
    failedToLoadFile: 'Не удалось загрузить файл',
    failedToLoadLogs: 'Не удалось загрузить логи',
    failedToLoadSettings: 'Не удалось загрузить настройки',
    failedToLoadBackups: 'Не удалось загрузить резервные копии',
    failedToLoadBackupContent: 'Не удалось загрузить содержимое резервной копии',
    failedToCopyBackup: 'Не удалось скопировать резервную копию',
    failedToLoadBackup: 'Не удалось загрузить резервную копию',
    backupCopiedToClipboard: 'Резервная копия скопирована в буфер обмена',
    backupLoadedToEditor: 'Резервная копия загружена в редактор',
    outputCopiedToClipboard: 'Вывод скопирован в буфер обмена',
    failedToCopyToClipboard: 'Не удалось скопировать в буфер обмена',
    noChangesSinceLastSave: 'Нет изменений с последнего сохранения',
    serviceStarting: 'Запуск сервиса...',
    serviceStopping: 'Остановка сервиса...',
    xkeenRestarting: 'Перезапуск Xkeen...',
    failedToStartService: 'Не удалось запустить сервис',
    failedToStopService: 'Не удалось остановить сервис',
    restartFailed: 'Ошибка перезапуска',
    logLevelUpdated: 'Уровень логирования обновлён',
    failedToUpdateLogLevel: 'Не удалось обновить уровень логирования',
    failedToCheckUpdates: 'Не удалось проверить обновления',
    failedToSwitchMode: 'Не удалось переключить режим',
    failedToExecuteCommand: 'Ошибка выполнения команды:',
    commandFailedWithExitCode: 'Команда завершилась с кодом',
    websocketConnectionError: 'Ошибка WebSocket соединения',

    // Password change errors
    allPasswordFieldsRequired: 'Все поля пароля обязательны',
    newPasswordMin8Chars: 'Новый пароль должен содержать минимум 8 символов',
    newPasswordsDoNotMatch: 'Новые пароли не совпадают',
    newPasswordMustDiffer: 'Новый пароль должен отличаться от текущего',
    failedToChangePassword: 'Не удалось изменить пароль',

    // Login page
    password: 'Пароль',
    login: 'Войти',
    changePasswordTitle: 'Смена пароля',
    defaultCredentialsWarning: 'Обнаружены стандартные учётные данные!',
    mustChangePassword: 'Необходимо сменить пароль перед продолжением.',
    currentPasswordAdmin: 'Текущий пароль (admin)',
    newPasswordPlaceholder: 'Новый пароль',
    confirmNewPassword: 'Подтверждение нового пароля',
    passwordRequirementsHint: 'Минимум 8 символов, рекомендуется: 12+ с разным регистром, цифрами, символами',
    passwordChangedSuccess: 'Пароль изменён! Перенаправление...',
    autoLoginFailed: 'Автоматический вход не удался, войдите вручную',
    networkError: 'Ошибка сети',
    loginFailed: 'Ошибка входа',
    mustChangeDefaultPassword: 'Необходимо сменить стандартный пароль',

    // Password strength
    weakPassword: 'Слабый: добавьте заглавные буквы, цифры или символы',
    mediumPassword: 'Средний: рекомендуется добавить сложность',
    strongPassword: 'Надёжный пароль'
};

/**
 * Get translation by key
 * @param {string} key - Translation key
 * @param {...string} args - Arguments for interpolation
 * @returns {string} Translated string
 */
export function t(key, ...args) {
    let text = translations[key] || key;

    // Simple interpolation: replace {0}, {1}, etc.
    args.forEach((arg, index) => {
        text = text.replace(`{${index}}`, arg);
    });

    return text;
}

/**
 * Get all translations object
 * @returns {Object} All translations
 */
export function getTranslations() {
    return translations;
}

// Make translations available globally for Alpine.js
window.i18n = translations;
window.t = t;

export default translations;
