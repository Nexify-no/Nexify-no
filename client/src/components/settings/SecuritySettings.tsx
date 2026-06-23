/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Shield, AlertTriangle, CheckCircle2, Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface SecuritySettingsProps {
  language: 'no' | 'en';
}

export function SecuritySettings({ language }: SecuritySettingsProps) {
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
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
    },
  };

  const t = labels[language];

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
    toast.success(t.success);
    setShowPasswordChange(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleEnable2FA = () => {
    setQrCodeUrl('https://via.placeholder.com/200?text=QR+Code');
    setBackupCodes(['XXXX-XXXX-XXXX', 'YYYY-YYYY-YYYY', 'ZZZZ-ZZZZ-ZZZZ']);
    setShowQRCode(true);
  };

  const handleDisable2FA = () => {
    setTwoFAEnabled(false);
    toast.success(t.success);
  };

  const copyBackupCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t.copied);
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
            {twoFAEnabled
              ? language === 'no'
                ? '2FA er aktivert på kontoen din'
                : '2FA is enabled on your account'
              : language === 'no'
              ? 'Aktiver 2FA for ekstra sikkerhet'
              : 'Enable 2FA for extra security'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {twoFAEnabled ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">{t.enabled}</span>
              </div>
              <Button variant="destructive" onClick={handleDisable2FA}>
                {t.disable2FA}
              </Button>
            </div>
          ) : (
            <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
              <DialogTrigger asChild>
                <Button onClick={handleEnable2FA}>{t.enable2FA}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t.setup2FA}</DialogTitle>
                  <DialogDescription>{t.scanQR}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <img src={qrCodeUrl} alt="QR Code" className="h-48 w-48" />
                  </div>
                  <div>
                    <Label className="mb-2 block text-sm font-medium">{t.backupCodes}</Label>
                    <div className="space-y-2">
                      {backupCodes.map((code, index) => (
                        <div key={index} className="flex items-center justify-between rounded-md bg-gray-100 p-2">
                          <code className="text-sm font-mono">{code}</code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyBackupCode(code)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      {t.saveBackupCodes}
                    </AlertDescription>
                  </Alert>
                </div>
                <DialogFooter>
                  <Button onClick={() => setShowQRCode(false)}>{t.done}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
              <Button variant="outline">{t.changePassword}</Button>
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