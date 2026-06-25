/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from 'react';
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Shield, AlertTriangle, CheckCircle2, Copy, Eye, EyeOff, Download } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface SecuritySettingsProps {
  language: 'no' | 'en';
}

export function SecuritySettings({ language }: SecuritySettingsProps) {
  const utils = trpc.useUtils();
  const { data: status } = trpc.twoFactor.status.useQuery();

  // 2FA flow state
  const [setupData, setSetupData] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [disableCode, setDisableCode] = useState('');

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [activityLogs] = useState<any[]>([]);
  const [showActivityLogs, setShowActivityLogs] = useState(false);

  const labels = {
    no: {
      security: 'Sikkerhet',
      twoFA: 'Tofaktorgodkjenning (2FA)',
      enable2FA: 'Aktiver 2FA',
      disable2FA: 'Deaktiver 2FA',
      setup2FA: 'Sett opp 2FA',
      scanQR: 'Skann QR-koden med en autentiseringsapp',
      backupCodes: 'Sikkerhetskoder',
      backupCodesDesc: 'Lagre disse kodene på et sikkert sted. Du kan bruke dem for å få tilgang hvis du mister enheten din.',
      copyCode: 'Kopier kode',
      copied: 'Kopiert!',
      passwordChange: 'Endre passord',
      currentPassword: 'Gjeldende passord',
      newPassword: 'Nytt passord',
      confirmPassword: 'Bekreft passord',
      changePassword: 'Endre passord',
      passwordStrength: 'Passordstyrke',
      weak: 'Svak',
      fair: 'Akseptabel',
      good: 'God',
      strong: 'Sterk',
      activityLogs: 'Aktivitetslogg',
      viewLogs: 'Vis aktivitetslogg',
      action: 'Handling',
      timestamp: 'Tidspunkt',
      ipAddress: 'IP-adresse',
      userAgent: 'Enhet',
      noActivity: 'Ingen aktivitet registrert',
      success: 'Suksess',
      error: 'Feil',
      warning: 'Advarsel',
      securityTip: 'Sikkerhetstips',
      useStrongPassword: 'Bruk et sterkt passord med minst 12 tegn, inkludert små og store bokstaver, tall og spesialtegn.',
      enable2FATip: 'Aktiver tofaktorgodkjenning for ekstra sikkerhet.',
      saveBackupCodes: 'Lagre sikkerhetskodene på et sikkert sted.',
      enabled: 'Aktivert',
      done: 'Ferdig',
      cancel: 'Avbryt',
      twoFAEnabled: '2FA er aktivert',
      twoFAExplain: 'Tofaktorgodkjenning legger til et ekstra sikkerhetslag på kontoen din ved å kreve en kode fra en autentiseringsapp i tillegg til passordet.',
      addKeyInstruction: 'Legg til denne nøkkelen i en autentiseringsapp (Google Authenticator, Authy, 1Password):',
      copy: 'Kopier',
      otpauthLink: 'otpauth-lenke',
      scanQr: 'Skann QR-koden med autentiseringsappen din:',
      orEnterKey: 'Eller skriv inn nøkkelen manuelt:',
      enterCode: 'Skriv inn den 6-sifrede koden fra appen',
      activate: 'Aktiver',
      enterDisableCode: 'Skriv inn en 6-sifret kode eller en reservekode for å bekrefte',
      confirm: 'Bekreft',
      backupCodesSaved: '2FA aktivert! Lagre disse reservekodene (vises kun én gang):',
      copyAll: 'Kopier alle',
      downloadCodes: 'Last ned',
    },
    en: {
      security: 'Security',
      twoFA: 'Two-Factor Authentication (2FA)',
      enable2FA: 'Enable 2FA',
      disable2FA: 'Disable 2FA',
      setup2FA: 'Set up 2FA',
      scanQR: 'Scan the QR code with an authenticator app',
      backupCodes: 'Backup Codes',
      backupCodesDesc: 'Save these codes in a safe place. You can use them to access your account if you lose your device.',
      copyCode: 'Copy Code',
      copied: 'Copied!',
      passwordChange: 'Change Password',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmPassword: 'Confirm Password',
      changePassword: 'Change Password',
      passwordStrength: 'Password Strength',
      weak: 'Weak',
      fair: 'Fair',
      good: 'Good',
      strong: 'Strong',
      activityLogs: 'Activity Logs',
      viewLogs: 'View Activity Logs',
      action: 'Action',
      timestamp: 'Timestamp',
      ipAddress: 'IP Address',
      userAgent: 'Device',
      noActivity: 'No activity recorded',
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      securityTip: 'Security Tip',
      useStrongPassword: 'Use a strong password with at least 12 characters, including uppercase, lowercase, numbers, and special characters.',
      enable2FATip: 'Enable two-factor authentication for extra security.',
      saveBackupCodes: 'Save the backup codes in a safe place.',
      enabled: 'Enabled',
      done: 'Done',
      cancel: 'Cancel',
      twoFAEnabled: '2FA is enabled',
      twoFAExplain: 'Two-factor authentication adds an extra layer of security to your account by requiring a code from an authenticator app in addition to your password.',
      addKeyInstruction: 'Add this key to an authenticator app (Google Authenticator, Authy, 1Password):',
      copy: 'Copy',
      otpauthLink: 'otpauth link',
      scanQr: 'Scan the QR code with your authenticator app:',
      orEnterKey: 'Or enter the key manually:',
      enterCode: 'Enter the 6-digit code from the app',
      activate: 'Activate',
      enterDisableCode: 'Enter a 6-digit code or a backup code to confirm',
      confirm: 'Confirm',
      backupCodesSaved: '2FA enabled! Save these backup codes (shown only once):',
      copyAll: 'Copy all',
      downloadCodes: 'Download',
    },
  };

  const t = labels[language];

  const setupMutation = trpc.twoFactor.setup.useMutation({
    onSuccess: (data) => {
      setSetupData(data);
      setCode('');
    },
    onError: (e) => toast.error(e.message),
  });

  const enableMutation = trpc.twoFactor.enable.useMutation({
    onSuccess: (data) => {
      setBackupCodes(data.backupCodes);
      toast.success(t.success);
      utils.twoFactor.status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const disableMutation = trpc.twoFactor.disable.useMutation({
    onSuccess: () => {
      toast.success(t.success);
      utils.twoFactor.status.invalidate();
      setDisabling(false);
      setDisableCode('');
      setSetupData(null);
      setBackupCodes(null);
      setCode('');
    },
    onError: (e) => toast.error(e.message),
  });

  const handlePasswordChange = (password: string) => {
    setNewPassword(password);
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    setPasswordStrength(strength);
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t.error);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(language === 'no' ? 'Passordene samsvarer ikke' : 'Passwords do not match');
      return;
    }
    if (passwordStrength < 3) {
      toast.error(language === 'no' ? 'Passord er for svakt' : 'Password is too weak');
      return;
    }
    toast.info(language === 'no' ? 'Endre passord kommer snart' : 'Change password coming soon');
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t.copied);
  };

  const handleDownloadCodes = () => {
    if (!backupCodes) return;
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'penna-2fa-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFinish = () => {
    setSetupData(null);
    setBackupCodes(null);
    setCode('');
  };

  const getPasswordStrengthLabel = () => {
    if (passwordStrength <= 1) return t.weak;
    if (passwordStrength === 2) return t.fair;
    if (passwordStrength === 3) return t.good;
    return t.strong;
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 1) return 'bg-red-500';
    if (passwordStrength === 2) return 'bg-yellow-500';
    if (passwordStrength === 3) return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      <Alert className="border-blue-200 bg-blue-50">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <strong>{t.securityTip}:</strong> {t.useStrongPassword}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t.twoFA}
          </CardTitle>
          <CardDescription>
            {status?.enabled
              ? language === 'no'
                ? '2FA er aktivert på kontoen din'
                : '2FA is enabled on your account'
              : language === 'no'
              ? 'Aktiver 2FA for ekstra sikkerhet'
              : 'Enable 2FA for extra security'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* State: just enabled — show backup codes (one-time) */}
          {backupCodes ? (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {t.backupCodesSaved}
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-2 rounded-md border bg-gray-50 p-4 dark:bg-gray-900">
                {backupCodes.map((bc) => (
                  <code
                    key={bc}
                    className="select-all font-mono text-sm text-gray-800 dark:text-gray-200"
                  >
                    {bc}
                  </code>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => copyText(backupCodes.join('\n'))}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t.copyAll}
                </Button>
                <Button variant="outline" onClick={handleDownloadCodes}>
                  <Download className="mr-2 h-4 w-4" />
                  {t.downloadCodes}
                </Button>
                <Button onClick={handleFinish}>{t.done}</Button>
              </div>
            </div>
          ) : status?.enabled ? (
            /* State: enabled — allow disabling */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">
                    {t.twoFAEnabled} ✓
                  </span>
                </div>
                {!disabling && (
                  <Button variant="destructive" onClick={() => setDisabling(true)}>
                    {t.disable2FA}
                  </Button>
                )}
              </div>
              {disabling && (
                <div className="space-y-3 rounded-md border p-4">
                  <Label htmlFor="disable-code">{t.enterDisableCode}</Label>
                  <Input
                    id="disable-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={12}
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    placeholder="123456"
                    className="font-mono"
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDisabling(false);
                        setDisableCode('');
                      }}
                    >
                      {t.cancel}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={disableMutation.isPending || disableCode.length < 6}
                      onClick={() => disableMutation.mutate({ code: disableCode })}
                    >
                      {t.confirm}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : setupData ? (
            /* State: setup in progress */
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">{t.scanQr}</p>
                <div className="rounded-lg bg-white p-3 inline-block">
                  <QRCodeSVG value={setupData.otpauthUri} size={176} level="M" marginSize={1} />
                </div>
                <p className="text-xs text-muted-foreground">{t.orEnterKey}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 select-all break-all rounded-md border bg-gray-50 p-3 font-mono text-sm text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                    {setupData.secret}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => copyText(setupData.secret)}>
                    <Copy className="mr-2 h-4 w-4" />
                    {t.copy}
                  </Button>
                </div>
                <a
                  href={setupData.otpauthUri}
                  className="block break-all text-xs text-primary underline hover:opacity-80"
                >
                  {t.otpauthLink}
                </a>
              </div>
              <div className="space-y-2">
                <Label htmlFor="enable-code">{t.enterCode}</Label>
                <Input
                  id="enable-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="font-mono"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSetupData(null);
                      setCode('');
                    }}
                  >
                    {t.cancel}
                  </Button>
                  <Button
                    disabled={enableMutation.isPending || code.length < 6}
                    onClick={() => enableMutation.mutate({ code })}
                  >
                    {t.activate}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* State: not enabled, no setup in progress */
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.twoFAExplain}</p>
              <Button
                disabled={setupMutation.isPending}
                onClick={() => setupMutation.mutate()}
              >
                {t.setup2FA}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {t.passwordChange}
          </CardTitle>
          <CardDescription>
            {language === 'no'
              ? 'Endre passord for å holde kontoen din sikker'
              : 'Change your password to keep your account secure'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={showPasswordChange} onOpenChange={setShowPasswordChange}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled>
                {t.changePassword}{language === 'no' ? ' (kommer snart)' : ' (coming soon)'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.passwordChange}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="current-password">{t.currentPassword}</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="new-password">{t.newPassword}</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                      className="mt-1 pr-10"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-500"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{t.passwordStrength}:</span>
                      <span className="font-medium">{getPasswordStrengthLabel()}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200">
                      <div
                        className={`h-full rounded-full transition-all ${getPasswordStrengthColor()}`}
                        style={{ width: `${(passwordStrength / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirm-password">{t.confirmPassword}</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPasswordChange(false)}>
                  {t.cancel}
                </Button>
                <Button onClick={handleChangePassword}>{t.changePassword}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t.activityLogs}
          </CardTitle>
          <CardDescription>
            {language === 'no'
              ? 'Se din aktivitetshistorikk for sikkerhet'
              : 'View your activity history for security'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={showActivityLogs} onOpenChange={setShowActivityLogs}>
            <DialogTrigger asChild>
              <Button variant="outline">{t.viewLogs}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t.activityLogs}</DialogTitle>
              </DialogHeader>
              <div className="max-h-96 overflow-y-auto">
                {activityLogs.length > 0 ? (
                  <div className="space-y-2">
                    {activityLogs.map((log, index) => (
                      <div key={index} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{log.action}</span>
                          <span className="text-xs text-gray-500">{log.timestamp}</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-600">
                          <p>{t.ipAddress}: {log.ipAddress}</p>
                          <p>{t.userAgent}: {log.userAgent}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-sm text-gray-500">{t.noActivity}</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
