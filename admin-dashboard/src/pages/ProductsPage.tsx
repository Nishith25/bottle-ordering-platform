// admin-dashboard/src/pages/ProductsPage.tsx

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAdminAuth } from "../context/AuthContext";

import {
  archiveAdminProduct,
  createAdminProduct,
  fetchAdminProducts,
  updateAdminProduct,
  type AdminProduct,
  type ProductCategory,
  type ProductPayload,
} from "../services/api";

type ProductFormState = {
  productId: string;
  name: string;
  shortName: string;
  description: string;
  ingredients: string;
  sizeMl: string;
  price: string;
  category: ProductCategory;
  imageUrl: string;
  liquidColor: string;
  cardColor: string;
  accentColor: string;
  subscriptionEligible: boolean;
  available: boolean;
  sortOrder: string;
};

const EMPTY_FORM: ProductFormState = {
  productId: "",
  name: "",
  shortName: "",
  description: "",
  ingredients: "",
  sizeMl: "300",
  price: "",
  category: "Hydrating",
  imageUrl: "",
  liquidColor: "#DDEDDC",
  cardColor: "#EEF6EE",
  accentColor: "#32694B",
  subscriptionEligible: true,
  available: true,
  sortOrder: "0",
};

export default function ProductsPage() {
  const { token } = useAdminAuth();

  const [products, setProducts] =
    useState<AdminProduct[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [formOpen, setFormOpen] =
    useState(false);

  const [editingProductId, setEditingProductId] =
    useState<string | null>(null);

  const [form, setForm] =
    useState<ProductFormState>(
      EMPTY_FORM
    );

  const loadProducts =
    useCallback(async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data =
          await fetchAdminProducts(token);

        setProducts(data);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load products."
        );
      } finally {
        setLoading(false);
      }
    }, [token]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(
    () => {
      const query = search
        .trim()
        .toLowerCase();

      if (!query) {
        return products;
      }

      return products.filter(
        (product) =>
          product.name
            .toLowerCase()
            .includes(query) ||
          product.productId
            .toLowerCase()
            .includes(query) ||
          product.category
            .toLowerCase()
            .includes(query)
      );
    },
    [products, search]
  );

  function updateField<
    K extends keyof ProductFormState,
  >(
    field: K,
    value: ProductFormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingProductId(null);
    setFormOpen(false);
  };

  const openCreateForm = () => {
    setError(null);
    setSuccess(null);
    setForm(EMPTY_FORM);
    setEditingProductId(null);
    setFormOpen(true);
  };

  const openEditForm = (
    product: AdminProduct
  ) => {
    setError(null);
    setSuccess(null);

    setEditingProductId(
      product.productId
    );

    setForm({
      productId: product.productId,
      name: product.name,
      shortName: product.shortName,
      description:
        product.description,

      ingredients:
        product.ingredients.join(", "),

      sizeMl: String(product.sizeMl),
      price: String(product.price),
      category: product.category,
      imageUrl: product.imageUrl,
      liquidColor:
        product.liquidColor,
      cardColor: product.cardColor,
      accentColor:
        product.accentColor,

      subscriptionEligible:
        product.subscriptionEligible,

      available: product.available,

      sortOrder: String(
        product.sortOrder
      ),
    });

    setFormOpen(true);
  };

  const createPayload =
    (): ProductPayload => ({
      productId: form.productId
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),

      name: form.name.trim(),

      shortName:
        form.shortName.trim(),

      description:
        form.description.trim(),

      ingredients: form.ingredients
        .split(",")
        .map((ingredient) =>
          ingredient.trim()
        )
        .filter(Boolean),

      sizeMl: Number(form.sizeMl),
      price: Number(form.price),
      category: form.category,
      imageUrl: form.imageUrl.trim(),
      liquidColor:
        form.liquidColor,
      cardColor: form.cardColor,
      accentColor:
        form.accentColor,

      subscriptionEligible:
        form.subscriptionEligible,

      available: form.available,

      sortOrder:
        Number(form.sortOrder) || 0,
    });

  const validatePayload = (
    payload: ProductPayload
  ) => {
    if (!payload.productId) {
      return "Product ID is required.";
    }

    if (
      !payload.name ||
      !payload.shortName
    ) {
      return "Product name and short name are required.";
    }

    if (!payload.description) {
      return "Product description is required.";
    }

    if (
      !Number.isFinite(
        payload.sizeMl
      ) ||
      payload.sizeMl <= 0
    ) {
      return "Bottle size must be greater than zero.";
    }

    if (
      !Number.isFinite(
        payload.price
      ) ||
      payload.price < 0
    ) {
      return "Enter a valid product price.";
    }

    return null;
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!token || saving) {
      return;
    }

    const payload = createPayload();

    const validationError =
      validatePayload(payload);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (editingProductId) {
        const {
          productId: ignoredProductId,
          ...updates
        } = payload;

        void ignoredProductId;

        await updateAdminProduct(
          token,
          editingProductId,
          updates
        );

        setSuccess(
          "Product updated successfully."
        );
      } else {
        await createAdminProduct(
          token,
          payload
        );

        setSuccess(
          "Product created successfully."
        );
      }

      resetForm();
      await loadProducts();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save product."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAvailability = async (
    product: AdminProduct
  ) => {
    if (!token) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await updateAdminProduct(
        token,
        product.productId,
        {
          available:
            !product.available,
        }
      );

      setSuccess(
        product.available
          ? "Product hidden from customers."
          : "Product made available."
      );

      await loadProducts();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update availability."
      );
    }
  };

  const handleArchive = async (
    product: AdminProduct
  ) => {
    if (!token) {
      return;
    }

    const confirmed = window.confirm(
      `Archive ${product.name}? It will no longer appear in the customer app.`
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await archiveAdminProduct(
        token,
        product.productId
      );

      setSuccess(
        "Product archived successfully."
      );

      await loadProducts();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to archive product."
      );
    }
  };

  return (
    <div className="products-page">
      <div className="page-heading-row">
        <div>
          <h2>Bottle catalogue</h2>

          <p>
            Manage bottle details, prices and
            customer availability.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={openCreateForm}
        >
          + Add bottle
        </button>
      </div>

      {error ? (
        <div className="inline-error">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="inline-success">
          {success}
        </div>
      ) : null}

      <section className="panel products-toolbar">
        <input
          className="search-input"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search bottles, ID or category"
        />

        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => {
            void loadProducts();
          }}
        >
          {loading
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </section>

      <section className="panel product-table-panel">
        {loading &&
        products.length === 0 ? (
          <div className="page-state compact">
            <div className="spinner" />
            <p>Loading products</p>
          </div>
        ) : filteredProducts.length ===
          0 ? (
          <div className="page-state compact">
            <div className="state-icon">
              ◫
            </div>

            <h3>No products found</h3>

            <p>
              Add a bottle or change your
              search.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Bottle</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Subscription</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map(
                  (product) => (
                    <tr key={product._id}>
                      <td>
                        <div className="product-cell">
                          <div
                            className="product-swatch"
                            style={{
                              background:
                                product.cardColor,
                            }}
                          >
                            <span
                              style={{
                                background:
                                  product.liquidColor,
                              }}
                            />
                          </div>

                          <div>
                            <strong>
                              {product.name}
                            </strong>

                            <small>
                              {
                                product.productId
                              }
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        {product.category}
                      </td>

                      <td>
                        {product.sizeMl} ml
                      </td>

                      <td>
                        <strong>
                          ₹{product.price}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={`status-pill ${
                            product.available
                              ? "status-active"
                              : "status-inactive"
                          }`}
                        >
                          {product.available
                            ? "Available"
                            : "Hidden"}
                        </span>
                      </td>

                      <td>
                        {product.subscriptionEligible
                          ? "Eligible"
                          : "No"}
                      </td>

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="table-action"
                            onClick={() =>
                              openEditForm(
                                product
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="table-action"
                            onClick={() => {
                              void handleAvailability(
                                product
                              );
                            }}
                          >
                            {product.available
                              ? "Hide"
                              : "Activate"}
                          </button>

                          {product.available ? (
                            <button
                              type="button"
                              className="table-action danger"
                              onClick={() => {
                                void handleArchive(
                                  product
                                );
                              }}
                            >
                              Archive
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen ? (
        <div className="modal-backdrop">
          <div className="product-modal">
            <div className="modal-header">
              <div>
                <span className="form-eyebrow">
                  PRODUCT MANAGEMENT
                </span>

                <h2>
                  {editingProductId
                    ? "Edit bottle"
                    : "Add bottle"}
                </h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={resetForm}
              >
                ×
              </button>
            </div>

            <form
              className="product-form"
              onSubmit={handleSubmit}
            >
              <div className="form-grid">
                <label className="form-field">
                  <span>Product ID</span>

                  <input
                    value={form.productId}
                    disabled={Boolean(
                      editingProductId
                    )}
                    onChange={(event) =>
                      updateField(
                        "productId",
                        event.target.value
                      )
                    }
                    placeholder="watermelon-splash"
                  />
                </label>

                <label className="form-field">
                  <span>Product name</span>

                  <input
                    value={form.name}
                    onChange={(event) =>
                      updateField(
                        "name",
                        event.target.value
                      )
                    }
                    placeholder="Watermelon Splash"
                  />
                </label>

                <label className="form-field">
                  <span>Short label</span>

                  <input
                    value={form.shortName}
                    onChange={(event) =>
                      updateField(
                        "shortName",
                        event.target.value
                      )
                    }
                    placeholder="Watermelon"
                  />
                </label>

                <label className="form-field">
                  <span>Category</span>

                  <select
                    value={form.category}
                    onChange={(event) =>
                      updateField(
                        "category",
                        event.target
                          .value as ProductCategory
                      )
                    }
                  >
                    <option value="Hydrating">
                      Hydrating
                    </option>

                    <option value="Fruity">
                      Fruity
                    </option>
                  </select>
                </label>

                <label className="form-field">
                  <span>Price</span>

                  <input
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={(event) =>
                      updateField(
                        "price",
                        event.target.value
                      )
                    }
                    placeholder="109"
                  />
                </label>

                <label className="form-field">
                  <span>Size in ml</span>

                  <input
                    type="number"
                    min="1"
                    value={form.sizeMl}
                    onChange={(event) =>
                      updateField(
                        "sizeMl",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>Sort order</span>

                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(event) =>
                      updateField(
                        "sortOrder",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label className="form-field">
                  <span>
                    Image URL (optional)
                  </span>

                  <input
                    value={form.imageUrl}
                    onChange={(event) =>
                      updateField(
                        "imageUrl",
                        event.target.value
                      )
                    }
                    placeholder="https://..."
                  />
                </label>

                <label className="form-field full-width">
                  <span>Description</span>

                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      updateField(
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="Describe the bottle..."
                  />
                </label>

                <label className="form-field full-width">
                  <span>
                    Ingredients, separated by
                    commas
                  </span>

                  <input
                    value={form.ingredients}
                    onChange={(event) =>
                      updateField(
                        "ingredients",
                        event.target.value
                      )
                    }
                    placeholder="Watermelon juice, fruit pieces, chia seeds"
                  />
                </label>
              </div>

              <div className="colour-section">
                <h3>Bottle colours</h3>

                <div className="colour-grid">
                  <label className="colour-field">
                    <span>Liquid</span>

                    <input
                      type="color"
                      value={
                        form.liquidColor
                      }
                      onChange={(event) =>
                        updateField(
                          "liquidColor",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="colour-field">
                    <span>Card</span>

                    <input
                      type="color"
                      value={form.cardColor}
                      onChange={(event) =>
                        updateField(
                          "cardColor",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label className="colour-field">
                    <span>Accent</span>

                    <input
                      type="color"
                      value={
                        form.accentColor
                      }
                      onChange={(event) =>
                        updateField(
                          "accentColor",
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="toggle-grid">
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={
                      form.available
                    }
                    onChange={(event) =>
                      updateField(
                        "available",
                        event.target.checked
                      )
                    }
                  />

                  Available to customers
                </label>

                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={
                      form.subscriptionEligible
                    }
                    onChange={(event) =>
                      updateField(
                        "subscriptionEligible",
                        event.target.checked
                      )
                    }
                  />

                  Eligible for subscriptions
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={resetForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingProductId
                      ? "Save changes"
                      : "Create bottle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}