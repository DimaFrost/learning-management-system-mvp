import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Settings,
  Phone,
  Users,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Mail,
} from 'lucide-react';
import type { User, CourseStudent, MentorshipLog } from '../../types/lms';
import type { CadenceSettings } from '../../hooks/useCadenceSettings';
import { getStatusColor, getStatusBadgeColor } from '../../utils/statusStyles';
import { calculateOverallStatus, getCheckInStatus } from '../../utils/mentorshipUtils';

interface MentorshipManagementProps {
  users: User[];
  courseStudents: CourseStudent[];
  cadenceSettings: CadenceSettings;
  setCadenceSettings: (newSettings: CadenceSettings) => void;
  mentorshipLogs: MentorshipLog[];
  getUserById: (id: string | null) => User | undefined;
  onOpenCheckin: (studentId: string) => void;
}

export function MentorshipManagement({
  users,
  courseStudents,
  cadenceSettings,
  setCadenceSettings,
  mentorshipLogs,
  getUserById,
  onOpenCheckin,
}: MentorshipManagementProps) {
  const [showCadenceSettings, setShowCadenceSettings] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [tempCadenceSettings, setTempCadenceSettings] = useState(cadenceSettings);
  const [isSaving, setIsSaving] = useState(false);

  const mentorshipAnalytics = useMemo(() => {
    const studentMap = new Map<string, {
      id: string;
      studentName: string;
      mentorName: string;
      mentorId: string | null;
      overallStatus: string;
      digitalStatus: any;
      inPersonStatus: any;
      courses: number[];
    }>();

    courseStudents.forEach(cs => {
      const studentId = cs.studentId;
      const student = getUserById(studentId);
      const mentor = getUserById(cs.mentorId);
      const overallStatus = calculateOverallStatus(studentId, mentorshipLogs, cadenceSettings);
      const digitalStatus = getCheckInStatus(studentId, 'digital', mentorshipLogs, cadenceSettings);
      const inPersonStatus = getCheckInStatus(studentId, 'in_person', mentorshipLogs, cadenceSettings);

      if (studentMap.has(studentId)) {
        const existing = studentMap.get(studentId)!;
        existing.courses.push(cs.courseId);
      } else {
        studentMap.set(studentId, {
          id: studentId,
          studentName: student?.name || 'Unknown',
          mentorName: mentor?.name || 'Unassigned',
          mentorId: cs.mentorId,
          overallStatus,
          digitalStatus,
          inPersonStatus,
          courses: [cs.courseId]
        });
      }
    });

    const allStudents = Array.from(studentMap.values());

    const atRiskPairs = allStudents.filter(pair => pair.overallStatus === 'at_risk');
    const laggingPairs = allStudents.filter(pair => pair.overallStatus === 'lagging');
    const onTrackPairs = allStudents.filter(pair => pair.overallStatus === 'on_track');

    return {
      totalPairs: allStudents.length,
      atRiskPairs: atRiskPairs.length,
      laggingPairs: laggingPairs.length,
      onTrackPairs: onTrackPairs.length,
      allStudents
    };
  }, [courseStudents, cadenceSettings]);

  const analytics = mentorshipAnalytics;

  const handleContactMentor = (mentorId: string | null, studentName: string) => {
    const mentor = mentorId ? getUserById(mentorId) : undefined;
    if (mentor) {
      alert(`Contact ${mentor.name} about ${studentName}\n\nEmail: ${mentor.email || 'No email available'}`);
    }
  };

  const handleTempCadenceChange = useCallback((type: 'digital' | 'inPerson', field: string, value: number) => {
    setTempCadenceSettings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  }, []);

  const saveCadenceSettings = useCallback(async () => {
    setIsSaving(true);

    setCadenceSettings(tempCadenceSettings);

    await new Promise(resolve => setTimeout(resolve, 500));

    setIsSaving(false);
    setShowCadenceSettings(false);
  }, [tempCadenceSettings, setCadenceSettings]);

  const cancelCadenceSettings = useCallback(() => {
    setTempCadenceSettings(cadenceSettings);
    setShowCadenceSettings(false);
  }, [cadenceSettings]);

  useEffect(() => {
    if (showCadenceSettings) {
      setTempCadenceSettings(cadenceSettings);
    }
  }, [showCadenceSettings, cadenceSettings]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Mentorship Risk Management</h2>
            <p className="text-gray-600">Cadence-aware monitoring with configurable thresholds</p>
          </div>
          <button
            onClick={() => setShowCadenceSettings(!showCadenceSettings)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configure Cadences
          </button>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Cadence Requirements</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-medium text-blue-900">Digital Check-ins</h4>
                <p className="text-sm text-blue-700">
                  Expected: Every {cadenceSettings.digital.expectedDays} days |
                  Warning: {cadenceSettings.digital.warningDays}+ days |
                  Critical: {cadenceSettings.digital.criticalDays}+ days
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="font-medium text-green-900">In-Person Check-ins</h4>
                <p className="text-sm text-green-700">
                  Expected: Every {cadenceSettings.inPerson.expectedDays} days |
                  Warning: {cadenceSettings.inPerson.warningDays}+ days |
                  Critical: {cadenceSettings.inPerson.criticalDays}+ days
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCadenceSettings && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Check-in Cadence Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(tempCadenceSettings).map(([type, settings]) => (
              <div key={type} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 capitalize">
                  {type === 'inPerson' ? 'In-Person' : 'Digital'} Check-ins
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expected Frequency (days)
                    </label>
                    <input
                      type="number"
                      value={settings.expectedDays}
                      onChange={(e) => handleTempCadenceChange(type as 'digital' | 'inPerson', 'expectedDays', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Warning Threshold (days)
                    </label>
                    <input
                      type="number"
                      value={settings.warningDays}
                      onChange={(e) => handleTempCadenceChange(type as 'digital' | 'inPerson', 'warningDays', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Critical Threshold (days)
                    </label>
                    <input
                      type="number"
                      value={settings.criticalDays}
                      onChange={(e) => handleTempCadenceChange(type as 'digital' | 'inPerson', 'criticalDays', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={cancelCadenceSettings}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={saveCadenceSettings}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Risk levels are calculated based on a 50/50 weighted average of digital and in-person check-ins.
              Changes will take effect and recalculate all risk assessments when you click "Save Settings".
            </p>
          </div>
        </div>
      )}

      {(statusFilter === null || statusFilter === 'at_risk') && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Alerts</h3>
          <div className="space-y-3">
            {analytics.allStudents
              .filter(pair => pair.overallStatus === 'at_risk')
              .map((pair) => (
                <div key={pair.id} className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">
                      {pair.studentName} & {pair.mentorName}
                    </p>
                    <div className="text-sm text-red-600 mt-1">
                      {pair.digitalStatus.status === 'at_risk' && (
                        <div>• Digital check-ins overdue: {pair.digitalStatus.message}</div>
                      )}
                      {pair.inPersonStatus.status === 'at_risk' && (
                        <div>• In-person check-ins overdue: {pair.inPersonStatus.message}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onOpenCheckin(pair.id)}
                      className="px-3 py-1 bg-red-600 text-white text-xs rounded-md hover:bg-red-700"
                    >
                      Log Check-in
                    </button>
                    <button
                      onClick={() => handleContactMentor(pair.mentorId, pair.studentName)}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" />
                      Contact Mentor
                    </button>
                  </div>
                </div>
              ))}
            {analytics.atRiskPairs === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                <p>No critical alerts - all pairs are meeting cadence requirements!</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className={`bg-white rounded-lg shadow border p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
            statusFilter === null
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300'
          }`}
          onClick={() => setStatusFilter(null)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Pairs</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalPairs}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div
          className={`bg-white rounded-lg shadow border p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
            statusFilter === 'at_risk'
              ? 'border-red-500 bg-red-50'
              : 'border-gray-200 hover:border-red-300'
          }`}
          onClick={() => setStatusFilter('at_risk')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">At Risk</p>
              <p className="text-2xl font-bold text-red-600">{analytics.atRiskPairs}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div
          className={`bg-white rounded-lg shadow border p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
            statusFilter === 'lagging'
              ? 'border-yellow-500 bg-yellow-50'
              : 'border-gray-200 hover:border-yellow-300'
          }`}
          onClick={() => setStatusFilter('lagging')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Lagging</p>
              <p className="text-2xl font-bold text-yellow-600">{analytics.laggingPairs}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div
          className={`bg-white rounded-lg shadow border p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
            statusFilter === 'on_track'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-green-300'
          }`}
          onClick={() => setStatusFilter('on_track')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">On Track</p>
              <p className="text-2xl font-bold text-green-600">{analytics.onTrackPairs}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Mentorship Pair Status Assessment</h2>
          {statusFilter && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Filtered by:</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(statusFilter)}`}>
                {statusFilter === 'at_risk' ? 'At Risk' :
                 statusFilter === 'lagging' ? 'Lagging' : 'On Track'}
              </span>
              <button
                onClick={() => setStatusFilter(null)}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Student</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Mentor</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Digital Status</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">In-Person Status</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Overall Status</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {analytics.allStudents
                .filter(pair => statusFilter === null || pair.overallStatus === statusFilter)
                .map((pair) => (
                <tr key={pair.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{pair.studentName}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{pair.mentorName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(pair.digitalStatus.status)}`}>
                      {pair.digitalStatus.message}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(pair.inPersonStatus.status)}`}>
                      {pair.inPersonStatus.message}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(pair.overallStatus)}`}>
                      {pair.overallStatus === 'at_risk' ? 'At Risk' :
                       pair.overallStatus === 'lagging' ? 'Lagging' : 'On Track'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => onOpenCheckin(pair.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Log Check-in
                      </button>
                      <button
                        onClick={() => handleContactMentor(pair.mentorId, pair.studentName)}
                        className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3" />
                        Contact Mentor
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
