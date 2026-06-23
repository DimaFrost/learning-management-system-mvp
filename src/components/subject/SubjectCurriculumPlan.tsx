import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import type { User } from '../../types/lms';
import { hasRole } from '../../utils/userUtils';
import { useSubjectCurriculumPlan } from '../../hooks/useSubjectCurriculumPlan';
import { LoadingSpinner } from '../ui/LoadingSpinner';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface SubjectCurriculumPlanProps {
  subjectId: number;
  currentUser: User;
  variant?: 'inline' | 'card';
}

export function SubjectCurriculumPlan({
  subjectId,
  currentUser,
  variant = 'inline',
}: SubjectCurriculumPlanProps) {
  const canEditCurriculum =
    hasRole(currentUser, 'administrator') || hasRole(currentUser, 'teacher');

  const { plan, loading, saving, saveCurriculumPlan } =
    useSubjectCurriculumPlan(subjectId, currentUser);

  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState('');

  const showCurriculumSection = canEditCurriculum || !!plan;

  const startEditPlan = () => {
    setPlanDraft(plan?.content ?? '');
    setIsEditingPlan(true);
  };

  const cancelEditPlan = () => {
    setIsEditingPlan(false);
    setPlanDraft('');
  };

  const handleSavePlan = async () => {
    const content = planDraft.trim();
    if (!content) return;
    await saveCurriculumPlan(content);
    setIsEditingPlan(false);
    setPlanDraft('');
  };

  if (!showCurriculumSection) return null;

  const editButton = canEditCurriculum && !isEditingPlan && plan && (
    <button
      type="button"
      onClick={startEditPlan}
      disabled={saving}
      className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium disabled:opacity-50"
    >
      <Pencil className="w-3 h-3" />
      Edit
    </button>
  );

  const editForm = isEditingPlan && (
    <div className="space-y-2 mt-1">
      <textarea
        value={planDraft}
        onChange={e => setPlanDraft(e.target.value)}
        rows={variant === 'inline' ? 4 : 8}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
        placeholder="Enter the subject curriculum plan..."
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSavePlan}
          disabled={saving || !planDraft.trim()}
          className="bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={cancelEditPlan}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );

  const planView = !isEditingPlan && plan && (
    <div>
      <p className={`whitespace-pre-wrap ${variant === 'inline' ? 'text-sm text-gray-600' : 'text-gray-700'}`}>
        {plan.content}
      </p>
      {variant === 'card' && (
        <p className="text-sm text-gray-500 mt-3">
          {plan.authorName} · Updated {formatDate(plan.updatedAt)}
        </p>
      )}
    </div>
  );

  const addButton = !isEditingPlan && !plan && canEditCurriculum && (
    <button
      type="button"
      onClick={startEditPlan}
      disabled={saving}
      className={`flex items-center gap-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-50 ${
        variant === 'inline' ? 'px-2 py-1 mt-1' : 'px-4 py-2 text-sm'
      }`}
    >
      <Plus className={variant === 'inline' ? 'w-3 h-3' : 'w-4 h-4'} />
      Add curriculum plan
    </button>
  );

  const content = loading ? (
    <LoadingSpinner message="Loading curriculum plan..." />
  ) : (
    <>
      {editForm}
      {planView}
      {addButton}
    </>
  );

  if (variant === 'card') {
    return (
      <section className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Subject Curriculum Plan</h3>
          {editButton && (
            <span className="text-sm">{editButton}</span>
          )}
        </div>
        {content}
      </section>
    );
  }

  return (
    <div>
      {loading ? (
        content
      ) : isEditingPlan ? (
        editForm
      ) : plan ? (
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{plan.content}</p>
          {editButton}
        </div>
      ) : (
        addButton
      )}
    </div>
  );
}
