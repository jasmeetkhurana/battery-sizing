import { useFormStore } from '../store/useFormStore';
import { InputField, SelectField, TextareaField } from '../components/FormField';
import { ErrorSummary } from '../components/ErrorSummary';
import { StepNav } from '../components/StepNav';
import { PREMISES_TYPES, GRID_CONNECTION_OPTIONS } from '../types';
import { INDIAN_STATES } from '../utils/constants';

export function Step0_CompanyProfile() {
  const company = useFormStore((s) => s.formData.company);
  const update = useFormStore((s) => s.updateCompany);
  const errors = useFormStore((s) => s.stepErrors[0]);

  return (
    <div>
      <ErrorSummary errors={errors} />

      <div className="card">
        <h2 className="card__title">Company & Site Information</h2>
        <div className="field-grid">
          <InputField
            label="Company Name"
            required
            error={errors['companyname']}
            inputProps={{
              name: 'companyName',
              value: company.companyName,
              onChange: (e) => update({ companyName: e.target.value }),
              placeholder: 'e.g. Tata Steel Ltd.',
            }}
          />
          <InputField
            label="Site Name"
            required
            error={errors['sitename']}
            inputProps={{
              name: 'siteName',
              value: company.siteName,
              onChange: (e) => update({ siteName: e.target.value }),
              placeholder: 'e.g. Jamshedpur Plant',
            }}
          />
          <SelectField
            label="Premises Type"
            required
            error={errors['premisestype']}
            options={PREMISES_TYPES.map((t) => ({ value: t, label: t }))}
            selectProps={{
              name: 'premisesType',
              value: company.premisesType,
              onChange: (e) => update({ premisesType: e.target.value as typeof company.premisesType }),
            }}
          />
          {company.premisesType === 'Other' && (
            <InputField
              label="Please specify"
              required
              error={errors['premisesothertext']}
              inputProps={{
                name: 'premisesOtherText',
                value: company.premisesOtherText,
                onChange: (e) => update({ premisesOtherText: e.target.value }),
                placeholder: 'Describe premises type',
              }}
            />
          )}
          <SelectField
            label="Grid Connection"
            required
            error={errors['gridconnection']}
            hint="Determines which supply details are relevant"
            options={GRID_CONNECTION_OPTIONS.map((g) => ({ value: g, label: g }))}
            selectProps={{
              name: 'gridConnection',
              value: company.gridConnection,
              onChange: (e) => update({ gridConnection: e.target.value as typeof company.gridConnection }),
            }}
          />
          <SelectField
            label="State"
            required
            error={errors['state']}
            options={INDIAN_STATES.map((s) => ({ value: s, label: s }))}
            selectProps={{
              name: 'state',
              value: company.state,
              onChange: (e) => update({ state: e.target.value }),
            }}
          />
          <InputField
            label="District"
            required
            error={errors['district']}
            inputProps={{
              name: 'district',
              value: company.district,
              onChange: (e) => update({ district: e.target.value }),
              placeholder: 'e.g. East Singhbhum',
            }}
          />
          <TextareaField
            label="Location Details"
            className="field-full"
            hint="Address, landmark, or GPS coordinates (optional)"
            textareaProps={{
              name: 'locationDetails',
              value: company.locationDetails,
              onChange: (e) => update({ locationDetails: e.target.value }),
              placeholder: 'Optional — any extra location info',
            }}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="card__title">Person in Charge</h2>
        <div className="field-grid">
          <InputField
            label="Contact Name"
            required
            error={errors['contactname']}
            inputProps={{
              name: 'contactName',
              value: company.contactName,
              onChange: (e) => update({ contactName: e.target.value }),
              placeholder: 'Full name',
            }}
          />
          <InputField
            label="Role / Designation"
            inputProps={{
              name: 'contactRole',
              value: company.contactRole,
              onChange: (e) => update({ contactRole: e.target.value }),
              placeholder: 'e.g. Plant Manager',
            }}
          />
          <InputField
            label="Phone"
            required
            type="tel"
            error={errors['contactphone']}
            hint="+91 or 10-digit number"
            inputProps={{
              name: 'contactPhone',
              value: company.contactPhone,
              onChange: (e) => update({ contactPhone: e.target.value }),
              placeholder: '+91 9876543210',
            }}
          />
          <InputField
            label="Email"
            required
            type="email"
            error={errors['contactemail']}
            inputProps={{
              name: 'contactEmail',
              value: company.contactEmail,
              onChange: (e) => update({ contactEmail: e.target.value }),
              placeholder: 'contact@company.com',
            }}
          />
        </div>
      </div>

      <StepNav />
    </div>
  );
}
